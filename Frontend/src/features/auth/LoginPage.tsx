import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUiStore } from '@/stores/useUiStore';
import { Shield, Lock, User, AlertCircle } from 'lucide-react';
import { Card } from '@/ui/Card';

export const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const { login, isAuthenticated } = useUiStore();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    // If already authenticated, redirect immediately
    React.useEffect(() => {
        if (isAuthenticated) {
            navigate('/vessel-dashboard');
        }
    }, [isAuthenticated, navigate]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const success = login(username, password);
        if (success) {
            navigate('/vessel-dashboard');
        } else {
            setError('ACCESS DENIED: INVALID OPERATOR CREDENTIALS');
        }
    };

    return (
        <div className="h-screen w-screen flex items-center justify-center bg-[var(--abyss)] relative font-sans overflow-hidden">
            {/* Pulsating marine radar grid bg effect */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,242,254,0.05),transparent_60%)] pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-[var(--slick-teal)]/5 rounded-full pointer-events-none animate-ping opacity-25" style={{ animationDuration: '8s' }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] border border-[var(--slick-teal)]/5 rounded-full pointer-events-none animate-ping opacity-55" style={{ animationDuration: '5s' }} />

            <Card className="w-full max-w-md !p-8 border border-[var(--hairline)] bg-[var(--panel)]/70 backdrop-blur-md relative z-10 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
                {/* Brand Header */}
                <div className="text-center mb-8">
                    <div className="w-12 h-12 rounded-full border border-[var(--slick-teal)]/30 bg-[var(--slick-teal)]/5 mx-auto mb-4 flex items-center justify-center text-[var(--slick-teal)] relative shadow-[0_0_15px_rgba(0,242,254,0.15)] animate-pulse">
                        <Shield size={22} />
                    </div>
                    <h2 className="font-display font-bold text-base uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#C6F1F7] via-[#F983E9] to-[#B877FF]">
                        Secured Vessel Portal
                    </h2>
                    <p className="text-[10px] font-mono text-white/40 mt-1 uppercase tracking-widest">
                        Statutory Enforcement & Clearance Console
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5 font-mono text-xs">
                    {error && (
                        <div className="p-3 border border-[var(--signal-red)]/35 bg-[rgba(225,72,60,0.05)] rounded-[var(--radius-card)] flex items-center space-x-2 text-[var(--signal-red)]">
                            <AlertCircle size={14} className="shrink-0" />
                            <span className="font-bold text-[9px] uppercase tracking-wider">{error}</span>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-[9px] eyebrow uppercase tracking-wider text-white/50 block">Operator Username</label>
                        <div className="flex items-center bg-[var(--abyss)] border border-[var(--hairline)] rounded-[var(--radius-card)] px-3 focus-within:border-[var(--slick-teal)] transition-all">
                            <User size={13} className="text-white/35 mr-3 shrink-0" />
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-transparent py-2.5 text-white outline-none border-none pl-0"
                                placeholder="Enter operator ID"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[9px] eyebrow uppercase tracking-wider text-white/50 block">Security Keycode</label>
                        <div className="flex items-center bg-[var(--abyss)] border border-[var(--hairline)] rounded-[var(--radius-card)] px-3 focus-within:border-[var(--slick-teal)] transition-all">
                            <Lock size={13} className="text-white/35 mr-3 shrink-0" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-transparent py-2.5 text-white outline-none border-none pl-0"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full py-3 bg-[var(--slick-teal)] hover:bg-[var(--slick-teal)]/90 text-[var(--abyss)] font-bold uppercase rounded-[var(--radius-card)] tracking-widest transition-all cursor-pointer shadow-[0_0_15px_rgba(0,242,254,0.2)] mt-2"
                    >
                        REQUEST CLEARANCE
                    </button>

                    <div className="text-center pt-2">
                        <button
                            type="button"
                            onClick={() => navigate('/')}
                            className="text-[9px] text-white/45 hover:text-white transition-all uppercase tracking-widest cursor-pointer"
                        >
                            ← Return to Command Center
                        </button>
                    </div>
                </form>
            </Card>
        </div>
    );
};
export default LoginPage;
