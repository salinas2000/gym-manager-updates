import React from 'react';
import { Bar, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, CartesianAxis } from 'recharts';

export default function GrowthChart({ data }) {
    // Merge data: data.revenue has { revenue, month }, data.members has { members, month }
    // We assume both arrays align by month (Jan-Dec)
    const mergedData = data.revenue.map((item, index) => ({
        month: item.month,
        revenue: item.revenue,
        members: data.members[index] ? data.members[index].members : 0
    }));

    return (
        <div className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={mergedData}>
                    <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />

                    <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 12 }}
                        dy={10}
                    />

                    <YAxis
                        yAxisId="left"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 12 }}
                        tickFormatter={(value) => `${value}€`}
                    />

                    <YAxis
                        yAxisId="right"
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 12 }}
                    />

                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            backdropFilter: 'blur(8px)',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)'
                        }}
                        itemStyle={{ color: '#e2e8f0', fontSize: '13px' }}
                        labelStyle={{ color: '#94a3b8', marginBottom: '8px' }}
                    />

                    <Bar
                        yAxisId="left"
                        dataKey="revenue"
                        fill="#10b981"
                        barSize={20}
                        radius={[4, 4, 0, 0]}
                        name="Revenue"
                    />

                    <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="members"
                        stroke="#06b6d4"
                        strokeWidth={3}
                        dot={{ r: 4, strokeWidth: 2, fill: '#0f172a' }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                        name="Active Members"
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}
