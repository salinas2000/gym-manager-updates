import React from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

export default function AcquisitionChart({ data }) {
    return (
        <div className="h-full w-full relative">
            <div className="absolute inset-0">
                <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <BarChart data={data}>
                        <defs>
                            <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#64748b', fontSize: 12 }}
                        />
                        <Tooltip
                            cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                            contentStyle={{
                                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                borderColor: 'rgba(255,255,255,0.1)',
                                borderRadius: '12px',
                                backdropFilter: 'blur(8px)',
                                padding: '12px'
                            }}
                            itemStyle={{ color: '#60a5fa', fontSize: '13px', fontWeight: 600 }}
                            labelStyle={{ color: '#94a3b8', marginBottom: '8px' }}
                        />
                        <Bar
                            dataKey="members"
                            name="New Members"
                            fill="url(#colorNew)"
                            radius={[4, 4, 0, 0]}
                            barSize={32}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
