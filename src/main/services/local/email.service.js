/**
 * Email Service — Sends emails via SMTP (nodemailer).
 * SMTP config is loaded from .env.local via credentials manager.
 * Same config for all gym installations (platform-level).
 */

const nodemailer = require('nodemailer');
const credentialManager = require('../../config/credentials');
const settingsService = require('./settings.service');

class EmailService {
    /**
     * Get SMTP config from credentials (.env.local)
     */
    getConfig() {
        const creds = credentialManager.get();
        return creds.smtp || {};
    }

    /**
     * Check if SMTP is configured
     */
    isConfigured() {
        const config = this.getConfig();
        return !!(config.host && config.user && config.pass);
    }

    /**
     * Create a nodemailer transporter from config
     */
    _createTransporter(config) {
        const port = parseInt(config.port) || 465;
        return nodemailer.createTransport({
            host: config.host,
            port,
            secure: port === 465,
            auth: {
                user: config.user,
                pass: config.pass,
            },
        });
    }

    /**
     * Get the "from name" — uses gym name from settings, falls back to config
     */
    _getFromName() {
        const gymName = settingsService.get('gym_name');
        if (gymName) return gymName;
        const config = this.getConfig();
        return config.fromName || 'Gym Manager Pro';
    }

    /**
     * Test SMTP connection
     */
    async testConnection() {
        try {
            const config = this.getConfig();
            const transporter = this._createTransporter(config);
            await transporter.verify();
            return { success: true, message: 'Conexion SMTP verificada correctamente' };
        } catch (err) {
            return { success: false, message: `Error de conexion: ${err.message}` };
        }
    }

    /**
     * Send mobile app invitation email
     */
    async sendInviteEmail(toEmail, customerName, inviteLink) {
        const config = this.getConfig();
        if (!this.isConfigured()) {
            throw new Error('SMTP no configurado. Revisa las credenciales en .env.local');
        }

        const fromName = this._getFromName();
        const transporter = this._createTransporter(config);

        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:Arial,sans-serif;">
  <div style="max-width:500px;margin:40px auto;background:#1e293b;border-radius:16px;padding:40px;border:1px solid #334155;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:48px;margin-bottom:16px;">🏋️</div>
      <h1 style="color:#f1f5f9;font-size:24px;margin:0 0 8px 0;">${fromName}</h1>
    </div>

    <p style="color:#cbd5e1;font-size:16px;line-height:1.6;margin-bottom:8px;">
      Hola <strong style="color:#f1f5f9;">${customerName || ''}</strong>,
    </p>

    <p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin-bottom:24px;">
      Te hemos dado acceso a la app del gimnasio. Haz clic en el siguiente boton para activar tu cuenta y crear tu contraseña:
    </p>

    <div style="text-align:center;margin:32px 0;">
      <a href="${inviteLink}"
         style="background-color:#6366f1;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:bold;font-size:16px;display:inline-block;">
        Activar mi cuenta
      </a>
    </div>

    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin-bottom:24px;">
      Una vez actives tu cuenta, podras acceder desde tu movil para ver tus rutinas, reservar clases y mucho mas.
    </p>

    <hr style="border:none;border-top:1px solid #334155;margin:24px 0;">

    <p style="color:#64748b;font-size:12px;text-align:center;line-height:1.5;">
      Si no esperabas este email, puedes ignorarlo.<br>
      Este enlace caduca en 24 horas.
    </p>
  </div>
</body>
</html>`;

        await transporter.sendMail({
            from: `"${fromName}" <${config.fromEmail || config.user}>`,
            to: toEmail,
            subject: `Tu acceso a la app de ${fromName}`,
            html,
        });

        console.log(`[EMAIL] Invitation sent to ${toEmail}`);
    }

    /**
     * Send password reset email
     */
    async sendResetEmail(toEmail, customerName, resetLink) {
        const config = this.getConfig();
        if (!this.isConfigured()) {
            throw new Error('SMTP no configurado.');
        }

        const fromName = this._getFromName();
        const transporter = this._createTransporter(config);

        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:Arial,sans-serif;">
  <div style="max-width:500px;margin:40px auto;background:#1e293b;border-radius:16px;padding:40px;border:1px solid #334155;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:48px;margin-bottom:16px;">🔑</div>
      <h1 style="color:#f1f5f9;font-size:24px;margin:0;">${fromName}</h1>
    </div>

    <p style="color:#cbd5e1;font-size:16px;line-height:1.6;margin-bottom:8px;">
      Hola <strong style="color:#f1f5f9;">${customerName || ''}</strong>,
    </p>

    <p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin-bottom:24px;">
      Has solicitado restablecer tu contraseña. Haz clic en el siguiente boton para crear una nueva:
    </p>

    <div style="text-align:center;margin:32px 0;">
      <a href="${resetLink}"
         style="background-color:#6366f1;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:bold;font-size:16px;display:inline-block;">
        Restablecer contraseña
      </a>
    </div>

    <hr style="border:none;border-top:1px solid #334155;margin:24px 0;">

    <p style="color:#64748b;font-size:12px;text-align:center;line-height:1.5;">
      Si no solicitaste este cambio, puedes ignorar este email.<br>
      Este enlace caduca en 24 horas.
    </p>
  </div>
</body>
</html>`;

        await transporter.sendMail({
            from: `"${fromName}" <${config.fromEmail || config.user}>`,
            to: toEmail,
            subject: `Recuperar contraseña - ${fromName}`,
            html,
        });

        console.log(`[EMAIL] Password reset sent to ${toEmail}`);
    }
}

module.exports = new EmailService();
