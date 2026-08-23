import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUiStore } from '@/stores/useUiStore';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { AlertCircle, Lock, User } from 'lucide-react';

const FigmaStar: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 34 33" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path d="M16.7417 0L18.9626 10.8982L27.6691 3.97724L22.3652 13.7533L33.4834 14.048L23.1365 18.1276L31.4641 25.5L20.9156 21.9743L22.556 32.9748L16.7417 23.4934L10.9274 32.9748L12.5678 21.9743L2.01927 25.5L10.3469 18.1276L-3.24249e-05 14.048L11.1182 13.7533L5.81431 3.97724L14.5208 10.8982L16.7417 0Z" fill="url(#login-star-grad)" />
        <defs>
            <linearGradient id="login-star-grad" x1="-1.59163" y1="-2.76742" x2="36.5955" y2="-1.98964" gradientUnits="userSpaceOnUse">
                <stop stopColor="#C6F1F7" />
                <stop offset="0.364583" stopColor="#F983E9" />
                <stop offset="0.739583" stopColor="#B877FF" />
                <stop offset="1" stopColor="#C2E9CD" />
            </linearGradient>
        </defs>
    </svg>
);

export const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const login = useUiStore((state) => state.login);
    const isAuthenticated = useUiStore((state) => state.isAuthenticated);

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    // If already logged in, redirect to dashboard
    React.useEffect(() => {
        if (isAuthenticated) {
            navigate('/', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!username || !password) {
            setError('Please supply both username and password.');
            return;
        }

        const success = login(username, password);
        if (success) {
            navigate('/', { replace: true });
        } else {
            setError('Could not verify credentials. Verify correct capitalization.');
        }
    };

    return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-[var(--abyss)] relative overflow-hidden select-none">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,rgba(184,119,255,0.06),transparent_60%)]" />
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#B877FF]/8 rounded-full blur-[140px] animate-pulse" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-[#F983E9]/8 rounded-full blur-[140px] animate-pulse" />

            <div className="w-[520px] z-10 p-4 space-y-6">
                <Card className="border border-white/20 p-12 shadow-[var(--shadow-panel)] relative overflow-hidden">
                    {/* Symmetrical Top Brand Line indicator card */}
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#C6F1F7] via-[#F983E9] to-[#B877FF]" />

                    {/* Logo/Branding Header */}
                    <div className="flex items-center justify-between mb-12">
                        <div>
                            <span className="text-xs font-mono text-white/40 tracking-[0.3em] block uppercase mb-3">
                                Secured Intelligence Portal
                            </span>
                            <h1 className="font-display font-black text-3xl tracking-[0.15em] text-transparent bg-clip-text bg-gradient-to-r from-[#C6F1F7] via-[#F983E9] to-[#B877FF]">
                                AEGISOCEAN
                            </h1>
                        </div>
                        <FigmaStar className="animate-[spin_24s_linear_infinite]" size={38} />
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        {error && (
                            <div className="p-4 bg-[var(--signal-red)]/10 border border-[var(--signal-red)]/40 text-[var(--signal-red)] text-xs font-mono rounded-[var(--radius-card)] flex items-start space-x-2 animate-shake">
                                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Username Input box - Doubled size, padded to prevent icon collision */}
                        <div className="space-y-3.5">
                            <label className="text-sm font-semibold font-mono text-white/60 tracking-wider uppercase block">
                                Username
                            </label>
                            <div className="relative">
                                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-white/25">
                                    <User size={18} />
                                </span>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter username"
                                    className="w-full h-18 bg-white/5 border border-white/10 rounded-[var(--radius-card)] pr-5 text-sm text-white placeholder-white/20 focus:border-white/30 focus:bg-white/8 focus:outline-none transition-all font-mono"
                                    style={{ paddingLeft: '4.5rem' }}
                                />
                            </div>
                        </div>

                        {/* Password Input box - Doubled size, padded to prevent icon collision */}
                        <div className="space-y-3.5">
                            <label className="text-sm font-semibold font-mono text-white/60 tracking-wider uppercase block">
                                Password
                            </label>
                            <div className="relative">
                                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-white/25">
                                    <Lock size={18} />
                                </span>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter passcode"
                                    className="w-full h-18 bg-white/5 border border-white/10 rounded-[var(--radius-card)] pr-5 text-sm text-white placeholder-white/20 focus:border-white/30 focus:bg-white/8 focus:outline-none transition-all font-mono"
                                    style={{ paddingLeft: '4.5rem' }}
                                />
                            </div>
                        </div>

                        <div className="pt-4">
                            <Button type="submit" variant="primary" className="w-full h-16 text-sm font-bold uppercase tracking-wider" size="md">
                                Establish Connection
                            </Button>
                        </div>
                    </form>

                    {/* Symmetrical footer detail bar */}
                    <div className="mt-10 pt-6 border-t border-white/5 flex items-center justify-between text-[9px] font-mono text-white/30 tracking-wider uppercase">
                        <span>SYS STAT: ACTIVE</span>
                        <span>DEV GATEWAY</span>
                    </div>
                </Card>

                {/* Separate credentials helper card below the form box */}
                <div className="p-4 bg-[var(--panel)] border border-white/10 rounded-[var(--radius-card)] text-center text-xs font-mono tracking-wide text-white/60 animate-fade-in shadow-[var(--shadow-panel)]">
                    <span className="text-[9px] eyebrow block mb-1">System Authorization Credentials</span>
                    <span className="text-white/80">Username:</span> <span className="text-[var(--slick-teal)] font-bold">admin</span>
                    <span className="text-white/30 mx-3">|</span>
                    <span className="text-white/80">Password:</span> <span className="text-[var(--slick-teal)] font-bold">admin</span>
                </div>
            </div>
        </div>
    );
};
export default LoginPage;
