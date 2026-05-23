const dbManager = require('../../db/database');
const z = require('zod');
const BaseService = require('../BaseService');

const PAYMENT_METHODS = ['Efectivo', 'Tarjeta', 'Stripe', 'Transferencia', 'Bizum', 'Otro'];

// Validation Schemas
const createPaymentSchema = z.object({
    customer_id: z.number().int().positive(),
    // FIX: Validate amount has max 2 decimal places to prevent float precision issues
    amount: z.number()
        // 0 permitido: representa cobertura por pago multi-mes anterior
        .nonnegative('Amount must be ≥ 0')
        .refine(
            val => Number.isInteger(val * 100),
            'Amount must have maximum 2 decimal places'
        ),
    tariff_name: z.string().optional(),
    payment_date: z.string().optional(), // ISO string from frontend
    payment_method: z.enum(PAYMENT_METHODS).optional().default('Efectivo'),
    payment_group_id: z.string().optional().nullable(),
});

const monthlyReportSchema = z.object({
    year: z.number().int().min(2000).max(2100),
    month: z.number().int().min(1).max(12)
});

class PaymentService extends BaseService {
    // FIX: Removed getGymId() - now inherited from BaseService

    getByCustomer(customerId) {
        const db = dbManager.getInstance();
        const stmt = db.prepare('SELECT * FROM payments WHERE customer_id = ? ORDER BY payment_date DESC');
        return stmt.all(customerId);
    }

    create(data) {
        const validation = createPaymentSchema.safeParse(data);
        if (!validation.success) {
            throw new Error(validation.error.errors[0].message);
        }

        const { customer_id, amount, tariff_name, payment_date, payment_method, payment_group_id } = validation.data;
        const db = dbManager.getInstance();

        // FIX: Use date-only format to avoid timezone issues
        const finalDate = payment_date || new Date().toISOString().split('T')[0];

        const gymId = this.getGymId();
        const stmt = db.prepare(`
            INSERT INTO payments (gym_id, customer_id, amount, tariff_name, payment_date, payment_method, payment_group_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(
            gymId, customer_id, amount, tariff_name || null, finalDate,
            payment_method || 'Efectivo', payment_group_id || null
        );

        return {
            id: info.lastInsertRowid,
            customer_id,
            amount,
            tariff_name,
            payment_date: finalDate,
            payment_method,
            payment_group_id: payment_group_id || null,
        };
    }

    /**
     * Lista de métodos de pago soportados.
     */
    getPaymentMethods() {
        return PAYMENT_METHODS;
    }

    /**
     * Lista de GRUPOS de pagos multi-mes (cada `payment_group_id` = una fila).
     * Permite ver múltiples periodos pagados del mismo cliente.
     * Devuelve por grupo:
     *   - payment_group_id
     *   - customer_id, first_name, last_name
     *   - tariff_name, payment_method
     *   - period_start: primer día del mes del primer pago del grupo
     *   - period_end: último día del mes del último pago del grupo
     *   - billing_months: nº de meses cubiertos (count del grupo)
     *   - total_amount: suma del grupo
     *   - status: 'vigente' | 'expirado'
     *   - days_remaining
     */
    getMultiMonthPayments() {
        const db = dbManager.getInstance();
        const now = new Date();

        const groups = db.prepare(`
            SELECT
                p.payment_group_id,
                p.customer_id,
                c.first_name,
                c.last_name,
                MIN(p.payment_date) as first_payment_date,
                MAX(p.payment_date) as last_payment_date,
                SUM(p.amount) as total_amount,
                COUNT(*) as months_count,
                MAX(p.tariff_name) as tariff_name,
                MAX(p.payment_method) as payment_method,
                MAX(p.id) as sample_payment_id
            FROM payments p
            JOIN customers c ON c.id = p.customer_id
            WHERE p.payment_group_id IS NOT NULL
            GROUP BY p.payment_group_id, p.customer_id
            ORDER BY MAX(p.payment_date) DESC
        `).all();

        const existingFormatted = groups.map(g => {
            const firstDate = new Date(g.first_payment_date);
            const lastDate = new Date(g.last_payment_date);
            const period_start = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
            const period_end = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 0);
            const diffMs = period_end.getTime() - now.getTime();
            const days_remaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            const status = days_remaining >= 0 ? 'vigente' : 'expirado';

            return {
                payment_group_id: g.payment_group_id,
                customer_id: g.customer_id,
                first_name: g.first_name,
                last_name: g.last_name,
                tariff_name: g.tariff_name,
                payment_method: g.payment_method,
                billing_months: g.months_count,
                total_amount: Math.round((g.total_amount || 0) * 100) / 100,
                first_payment_date: g.first_payment_date,
                last_payment_date: g.last_payment_date,
                period_start: period_start.toISOString(),
                period_end: period_end.toISOString(),
                days_remaining,
                status,
                sample_payment_id: g.sample_payment_id,
            };
        });

        // Clientes activos con tarifa multi-mes que NO tienen un grupo vigente
        // (todos sus grupos están expirados o no tienen ninguno).
        const customersWithActiveGroup = new Set(
            existingFormatted
                .filter(g => g.status === 'vigente')
                .map(g => g.customer_id)
        );

        // Solo "Sin pagar" si el cliente YA es socio hoy (start_date <= hoy, no expirado).
        // Un cliente con alta futura no se considera pendiente todavía.
        const todayISO = now.toISOString();
        const multiMonthCustomers = db.prepare(`
            SELECT
                c.id as customer_id,
                c.first_name,
                c.last_name,
                t.name as tariff_name,
                t.amount as tariff_amount,
                COALESCE(t.billing_months, 1) as billing_months,
                COALESCE(t.amount_is_total, 0) as amount_is_total,
                (SELECT start_date FROM memberships m
                 WHERE m.customer_id = c.id
                 ORDER BY m.start_date DESC LIMIT 1) as latest_start_date
            FROM customers c
            JOIN tariffs t ON c.tariff_id = t.id
            WHERE c.active = 1
            AND COALESCE(t.billing_months, 1) > 1
            AND EXISTS (
                SELECT 1 FROM memberships m
                WHERE m.customer_id = c.id
                AND m.start_date <= ?
                AND (m.end_date IS NULL OR m.end_date >= ?)
            )
            ORDER BY c.last_name ASC, c.first_name ASC
        `).all(todayISO, todayISO);

        const pendientesFormatted = multiMonthCustomers
            .filter(c => !customersWithActiveGroup.has(c.customer_id))
            .map(c => {
                const billing = c.billing_months;
                const expectedTotal = c.amount_is_total
                    ? c.tariff_amount
                    : c.tariff_amount * billing;
                return {
                    payment_group_id: null,
                    customer_id: c.customer_id,
                    first_name: c.first_name,
                    last_name: c.last_name,
                    tariff_name: c.tariff_name,
                    payment_method: null,
                    billing_months: billing,
                    total_amount: Math.round(expectedTotal * 100) / 100,
                    first_payment_date: null,
                    last_payment_date: null,
                    period_start: null,
                    period_end: null,
                    days_remaining: null,
                    status: 'pendiente',
                    sample_payment_id: null,
                };
            });

        return [...existingFormatted, ...pendientesFormatted];
    }

    /**
     * Lista los pagos individuales de un grupo. Útil para mostrar al usuario
     * qué meses se borrarán antes de confirmar la anulación.
     */
    getPaymentGroup(groupId) {
        if (!groupId) return [];
        const db = dbManager.getInstance();
        return db.prepare(`
            SELECT id, amount, tariff_name, payment_date, payment_method
            FROM payments
            WHERE payment_group_id = ?
            ORDER BY payment_date ASC
        `).all(groupId);
    }

    delete(id) {
        const db = dbManager.getInstance();
        const gymId = this.getGymId();

        const result = db.transaction(() => {
            // Si el pago pertenece a un grupo (multi-mes), anular el grupo entero
            const target = db.prepare('SELECT id, payment_group_id FROM payments WHERE id = ?').get(id);
            if (!target) return false;

            let toDelete;
            if (target.payment_group_id) {
                toDelete = db.prepare('SELECT id FROM payments WHERE payment_group_id = ?').all(target.payment_group_id);
            } else {
                toDelete = [{ id }];
            }

            const insertLog = db.prepare('INSERT INTO sync_deleted_log (gym_id, table_name, local_id) VALUES (?, ?, ?)');
            const deleteOne = db.prepare('DELETE FROM payments WHERE id = ?');
            let deletedCount = 0;
            for (const p of toDelete) {
                insertLog.run(gymId, 'payments', p.id);
                const info = deleteOne.run(p.id);
                deletedCount += info.changes;
            }
            return deletedCount > 0;
        })();

        return result;
    }

    async getMonthlyReport(year, month) {
        const validation = monthlyReportSchema.safeParse({ year, month });
        if (!validation.success) {
            throw new Error(validation.error.errors[0].message);
        }

        const db = dbManager.getInstance();

        // months are 1-12
        const monthStr = String(month).padStart(2, '0');
        const startDate = `${year}-${monthStr}-01`;
        const endDate = month === 12
            ? `${year + 1}-01-01`
            : `${year}-${String(month + 1).padStart(2, '0')}-01`;

        // Para tarifas con billing_months > 1, el rango "pagado" se extiende hacia atrás
        // tantos meses como billing_months. Ej: trimestral (3) cubre M, M-1 y M-2.
        // SQLite: date(?, '-N months') donde N = billing_months - 1.
        const stmt = db.prepare(`
            SELECT
                c.id,
                c.first_name,
                c.last_name,
                c.active,
                t.name as tariff_name,
                t.amount as tariff_amount,
                COALESCE(t.billing_months, 1) as billing_months,
                COALESCE(t.amount_is_total, 0) as amount_is_total,
                (SELECT SUM(amount) FROM payments p
                 WHERE p.customer_id = c.id
                 AND p.payment_date >= date(?, '-' || (COALESCE(t.billing_months, 1) - 1) || ' months')
                 AND p.payment_date < ?) as paid_amount,
                -- revenue_this_month: importe REAL recibido en este mes (no acumulado del periodo)
                (SELECT SUM(amount) FROM payments p
                 WHERE p.customer_id = c.id
                 AND p.payment_date >= ? AND p.payment_date < ?) as revenue_this_month,
                -- Fecha del pago REAL (amount > 0) que cubre este mes, dentro del rango billing_months
                (SELECT payment_date FROM payments p
                 WHERE p.customer_id = c.id
                 AND p.amount > 0
                 AND p.payment_date >= date(?, '-' || (COALESCE(t.billing_months, 1) - 1) || ' months')
                 AND p.payment_date < ?
                 ORDER BY payment_date DESC LIMIT 1) as real_payment_date,
                (SELECT id FROM payments p
                 WHERE p.customer_id = c.id
                 AND p.payment_date >= ? AND p.payment_date < ?
                 ORDER BY payment_date DESC LIMIT 1) as payment_id,
                (SELECT payment_group_id FROM payments p
                 WHERE p.customer_id = c.id
                 AND p.payment_date >= ? AND p.payment_date < ?
                 ORDER BY payment_date DESC LIMIT 1) as payment_group_id,
                (SELECT payment_method FROM payments p
                 WHERE p.customer_id = c.id
                 AND p.payment_date >= ? AND p.payment_date < ?
                 ORDER BY payment_date DESC LIMIT 1) as payment_method,
                -- Nombre de la tarifa snapshoteada en el pago REAL (amount > 0) que cubre este mes.
                -- Sirve para detectar cambios de tarifa: si paid_tariff_name != t.name, hubo cambio.
                (SELECT tariff_name FROM payments p
                 WHERE p.customer_id = c.id
                 AND p.amount > 0
                 AND p.payment_date >= date(?, '-' || (COALESCE(t.billing_months, 1) - 1) || ' months')
                 AND p.payment_date < ?
                 ORDER BY p.payment_date DESC LIMIT 1) as paid_tariff_name,
                (SELECT start_date FROM memberships m
                 WHERE m.customer_id = c.id 
                 AND (m.end_date IS NULL OR m.end_date >= ?)
                 AND m.start_date < ?
                 ORDER BY m.start_date DESC LIMIT 1) as joined_date
            FROM customers c
            LEFT JOIN tariffs t ON c.tariff_id = t.id
            WHERE EXISTS (
                SELECT 1 FROM memberships m 
                WHERE m.customer_id = c.id 
                AND (m.end_date IS NULL OR m.end_date >= ?)
                AND m.start_date < ?
            )
            ORDER BY c.last_name ASC, c.first_name ASC
        `);

        const data = stmt.all(
            startDate, endDate,            // 1. paid_amount (rango billing_months atrás)
            startDate, endDate,            // 2. revenue_this_month
            startDate, endDate,            // 3. real_payment_date (rango billing_months atrás)
            startDate, endDate,            // 4. payment_id
            startDate, endDate,            // 5. payment_group_id
            startDate, endDate,            // 6. payment_method
            startDate, endDate,            // 7. paid_tariff_name (rango billing_months atrás)
            startDate, endDate,            // 8. joined_date
            startDate, endDate             // 9. WHERE EXISTS membership filter
        );

        return data.map(item => {
            // Para tarifas multi-mes:
            //   - Si amount_is_total=1, el amount YA es el total del periodo
            //   - Si amount_is_total=0 (default), el amount es mensual → multiplicar por billing_months
            const months = item.billing_months || 1;
            const baseAmount = item.tariff_amount || 0;
            let targetAmount = item.amount_is_total ? baseAmount : baseAmount * months;

            // Proration Logic: If joined mid-month, calculate percentage of month
            if (item.joined_date) {
                // Robust parsing of "YYYY-MM-DD" ignoring timezones
                const joinParts = item.joined_date.split(/[-T ]/);
                const joinYear = parseInt(joinParts[0], 10);
                const joinMonth = parseInt(joinParts[1], 10);
                const joinDay = parseInt(joinParts[2], 10);

                if (joinYear === year && joinMonth === month) {
                    // Joined exactly in this month -> Prorate
                    const daysInMonth = new Date(year, month, 0).getDate();
                    // FIX: Edge case - if joinDay > daysInMonth (e.g. joined 31st in 30-day month)
                    // Ensure remainingDays is at least 1 to avoid 0 or negative values
                    const remainingDays = Math.max(1, daysInMonth - joinDay + 1);

                    if (remainingDays < daysInMonth && remainingDays > 0) {
                        targetAmount = (targetAmount / daysInMonth) * remainingDays;
                        targetAmount = Math.round(targetAmount * 100) / 100;
                    }
                }
            }

            const paid = item.paid_amount || 0;
            // Política: si el gimnasio registró cualquier pago > 0 (incluso menor
            // que la tarifa actual), consideramos el periodo cubierto — fue
            // decisión del usuario cobrar ese importe (descuento, tarifa antigua,
            // ajuste manual, etc.). No es deuda real: solo mostramos un aviso.
            const rawDiff = Math.round((targetAmount - paid) * 100) / 100;
            const isPaid = paid > 0
                ? true
                : paid >= (targetAmount - 0.5); // sin pago → comparación estricta
            const debt = isPaid ? 0 : Math.max(0, rawDiff);
            // Marca cambio nominal de tarifa para el tooltip explicativo
            const tariffNameChanged = !!(item.paid_tariff_name && item.tariff_name
                && item.paid_tariff_name !== item.tariff_name);
            // tariff_diff con signo: positivo = pagó menos, negativo = pagó más.
            // Aparece siempre que haya pago y diferencia perceptible (> 1 céntimo).
            const tariffDiff = paid > 0 && Math.abs(rawDiff) > 0.01 ? rawDiff : 0;

            return {
                ...item,
                tariff_amount: targetAmount,
                paid_amount: paid,
                is_paid: isPaid,
                debt,
                tariff_changed: tariffNameChanged,
                tariff_diff: tariffDiff,
            };
        });
    }

    async getDebtors() {
        const db = dbManager.getInstance();
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        // 1. Get all active customers with their tariff and Join Date
        const customers = db.prepare(`
            SELECT
                c.id,
                c.first_name,
                c.last_name,
                t.name as tariff_name,
                t.amount as tariff_amount,
                COALESCE(t.billing_months, 1) as billing_months,
                COALESCE(t.amount_is_total, 0) as amount_is_total,
                (SELECT start_date FROM memberships m
                 WHERE m.customer_id = c.id
                 ORDER BY m.start_date DESC LIMIT 1) as joined_date
            FROM customers c
            LEFT JOIN tariffs t ON c.tariff_id = t.id
            WHERE c.active = 1 AND joined_date IS NOT NULL
        `).all();

        // 2. Fetch ALL payments from the last 2 years in one go for these customers
        const twoYearsAgo = new Date(currentYear - 2, currentMonth, 1).toISOString();
        const allPayments = db.prepare(`
            SELECT customer_id, amount, payment_date, tariff_name,
                   strftime('%Y', payment_date) as year,
                   strftime('%m', payment_date) as month
            FROM payments
            WHERE payment_date >= ?
            ORDER BY payment_date ASC
        `).all(twoYearsAgo);

        // Group payments by customer and month (total amount + tariff_name del pago real > 0)
        const paymentMap = new Map();         // key -> sum amount
        const tariffSnapshotMap = new Map();  // key -> tariff_name del último pago > 0
        allPayments.forEach(p => {
            const key = `${p.customer_id}-${p.year}-${parseInt(p.month, 10)}`;
            paymentMap.set(key, (paymentMap.get(key) || 0) + p.amount);
            if (p.amount > 0 && p.tariff_name) {
                tariffSnapshotMap.set(key, p.tariff_name);
            }
        });

        const debtors = [];
        const monthLetters = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

        customers.forEach(customer => {
            const joinDate = new Date(customer.joined_date);
            const unpaidMonths = [];
            let totalDebt = 0;

            // Iterator date: Start from the 1st of the join month
            let iterDate = new Date(joinDate.getFullYear(), joinDate.getMonth(), 1);
            const stopDate = new Date(currentYear, currentMonth, 1);

            // Safety back-limit
            const startLimit = new Date(currentYear - 2, currentMonth, 1);
            if (iterDate < startLimit) iterDate = startLimit;

            const billingMonths = customer.billing_months || 1;
            const tariffBase = customer.tariff_amount || 0;
            // monthlyRequired: cuota mensual efectiva. Si la tarifa es multi-mes con amount_is_total, divide.
            const monthlyRequired = (billingMonths > 1 && customer.amount_is_total)
                ? (tariffBase / billingMonths)
                : tariffBase;

            while (iterDate <= stopDate) {
                const y = iterDate.getFullYear();
                const m = iterDate.getMonth();
                const monthDisplay = m + 1;

                const key = `${customer.id}-${y}-${monthDisplay}`;
                const paid = paymentMap.get(key) || 0;

                let requiredAmount = monthlyRequired;

                // Proration Join Month
                if (y === joinDate.getFullYear() && m === joinDate.getMonth()) {
                    const dayOfJoin = joinDate.getDate();
                    if (dayOfJoin > 1) {
                        const daysInMonth = new Date(y, m + 1, 0).getDate();
                        const daysToPay = daysInMonth - dayOfJoin + 1;
                        requiredAmount = (monthlyRequired / daysInMonth) * daysToPay;
                    }
                }

                // Política: cualquier pago > 0 en el periodo lo cubre. Si el gimnasio cobró un
                // importe (incluso reducido), no se considera deuda — fue decisión del usuario.
                let coveredByMultiMonth = false;
                if (billingMonths > 1) {
                    let sumInPeriod = 0;
                    for (let offset = 0; offset < billingMonths; offset++) {
                        const ref = new Date(y, m - offset, 1);
                        const k = `${customer.id}-${ref.getFullYear()}-${ref.getMonth() + 1}`;
                        sumInPeriod += paymentMap.get(k) || 0;
                    }
                    if (sumInPeriod > 0) coveredByMultiMonth = true;
                }

                // Para tarifas mensuales: cualquier pago > 0 en el mes cubre el periodo.
                if (billingMonths === 1 && paid > 0) {
                    coveredByMultiMonth = true; // reutilizamos el flag
                }

                if (!coveredByMultiMonth && paid < (requiredAmount - 1.0) && requiredAmount > 0) {
                    unpaidMonths.push({
                        year: y,
                        month: m,
                        letter: monthLetters[m],
                        amount: Math.round((requiredAmount - paid) * 100) / 100
                    });
                    totalDebt += (requiredAmount - paid);
                }

                iterDate.setMonth(iterDate.getMonth() + 1);
            }

            if (unpaidMonths.length > 2) {
                debtors.push({
                    ...customer,
                    unpaid_months: unpaidMonths,
                    total_debt: parseFloat(totalDebt.toFixed(2)),
                    last_payment_date: null
                });
            }
        });

        return debtors;
    }
}

module.exports = new PaymentService();
