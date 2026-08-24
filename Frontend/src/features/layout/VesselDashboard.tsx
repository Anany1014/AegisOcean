import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUiStore } from '@/stores/useUiStore';
import { Card } from '@/ui/Card';
import { Badge } from '@/ui/Badge';
import { Anchor, ShieldAlert, Navigation, Loader2, Link2, DollarSign, CheckCircle2 } from 'lucide-react';
import { VESSEL_DETECTIONS } from '@/mocks/vessels';

const FigmaStar: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 34 33" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path d="M16.7417 0L18.9626 10.8982L27.6691 3.97724L22.3652 13.7533L33.4834 14.048L23.1365 18.1276L31.4641 25.5L20.9156 21.9743L22.556 32.9748L16.7417 23.4934L10.9274 32.9748L12.5678 21.9743L2.01927 25.5L10.3469 18.1276L-3.24249e-05 14.048L11.1182 13.7533L5.81431 3.97724L14.5208 10.8982L16.7417 0Z" fill="url(#star-grad)" />
        <defs>
            <linearGradient id="star-grad" x1="-1.59163" y1="-2.76742" x2="36.5955" y2="-1.98964" gradientUnits="userSpaceOnUse">
                <stop stopColor="#C6F1F7" />
                <stop offset="0.364583" stopColor="#F983E9" />
                <stop offset="0.739583" stopColor="#B877FF" />
                <stop offset="1" stopColor="#C2E9CD" />
            </linearGradient>
        </defs>
    </svg>
);

export const VesselDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { fineEnforcedIncidents, logout } = useUiStore();
    const [currentTime, setCurrentTime] = useState<string>('');
    const [payments, setPayments] = useState<Record<string, 'pending' | 'paying' | 'paid'>>({});

    // Live clock
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            setCurrentTime(`${year}-${month}-${day} ${hours}:${minutes}:${seconds}`);
        };
        updateTime();
        const intervalId = setInterval(updateTime, 1000);
        return () => clearInterval(intervalId);
    }, []);

    // Live synchronization with fines enforced across windows/tabs
    useEffect(() => {
        const handleStorage = (e: StorageEvent) => {
            if (e.key === 'aegis_fines' && e.newValue) {
                try {
                    useUiStore.setState({ fineEnforcedIncidents: JSON.parse(e.newValue) });
                } catch (err) {
                    console.error(err);
                }
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    const handlePayment = async (incidentId: string) => {
        setPayments(prev => ({ ...prev, [incidentId]: 'paying' }));
        // Simulate Web3 transaction processing delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        setPayments(prev => ({ ...prev, [incidentId]: 'paid' }));
    };

    const handleBackClick = () => {
        navigate('/');
    };

    // Fleet Vessels Configuration (Dynamic union of all fleet & AIS tracked vessels)
    const baseFleet = [
        ...VESSEL_DETECTIONS.map(v => ({
            name: v.shipName,
            mmsi: v.mmsi,
            status: v.status === 'high_risk' ? 'HOLD' : 'ACTIVE',
            type: v.vesselType,
        })),
        { name: 'M.T. Ocean Sentinel', mmsi: '367123456', status: 'HOLD', type: 'Crude Oil Tanker' },
        { name: 'M.T. Gulf Voyager', mmsi: '368654321', status: 'ACTIVE', type: 'Chemical Carrier' },
        { name: 'M.T. Amoy Express', mmsi: '566123456', status: 'ACTIVE', type: 'Container Ship' },
    ];

    const fleetVessels = Array.from(new Map(baseFleet.map(v => [v.mmsi, v])).values());

    // Find enforced incidents matching our fleet MMSIs
    const enforcedList = Object.keys(fineEnforcedIncidents).map(id => {
        const r = fineEnforcedIncidents[id];
        const match = fleetVessels.find(v => v.mmsi === r.vesselMmsi);
        return {
            id,
            txHash: r.txHash,
            ipfsCid: r.ipfsCid,
            blockNumber: r.blockNumber,
            timestamp: r.timestamp,
            fineAmount: r.fineAmount,
            vesselMmsi: r.vesselMmsi,
            vesselName: match ? match.name : (r.vesselMmsi ? `Vessel MMSI ${r.vesselMmsi}` : 'Dark Vessel [Unidentified]'),
        };
    });

    return (
        <div className="h-screen w-screen flex flex-col bg-[var(--abyss)] overflow-hidden select-none">
            {/* Ambient background glows */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,rgba(0,242,254,0.04),transparent_60%)] pointer-events-none" />

            {/* Header */}
            <header className="h-16 border-b border-[var(--hairline)] bg-[var(--panel)] px-6 flex items-center justify-between z-40 relative">
                <div className="flex items-center space-x-4">
                    <div className="relative flex items-center justify-center pulse-bead text-[var(--slick-teal)] mr-1">
                        <FigmaStar className="animate-[spin_10s_linear_infinite]" size={24} />
                    </div>
                    <div>
                        <h1 className="font-display font-black text-sm tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#C6F1F7] via-[#F983E9] to-[#B877FF] flex items-center">
                            AEGISOCEAN <span className="text-white/40 mx-2">//</span> <span className="text-white font-medium text-[10px] tracking-widest">VESSEL OWNER PORTAL</span>
                        </h1>
                        <p className="text-[8px] font-mono text-white/50 tracking-wider uppercase">FLEET MONITORING GATEWAY · SECURE REGISTRY</p>
                    </div>
                </div>

                <div className="flex items-center space-x-4">
                    {currentTime && (
                        <div className="font-mono text-[9px] text-[var(--slick-teal)] pr-4 border-r border-[var(--hairline)]">
                            SECURE SESSION TIME: {currentTime}
                        </div>
                    )}
                    <button
                        onClick={handleBackClick}
                        className="px-3 py-1.5 text-[10px] font-mono tracking-widest text-[var(--slick-teal)] border border-[var(--slick-teal)]/20 hover:border-[var(--slick-teal)]/60 hover:bg-[var(--slick-teal)]/10 rounded-[var(--radius-chip)] transition-all flex items-center space-x-1.5 cursor-pointer uppercase font-bold"
                    >
                        <Navigation size={12} />
                        <span>COMMAND CENTER</span>
                    </button>
                    <button
                        onClick={() => {
                            logout();
                            navigate('/login');
                        }}
                        className="px-3 py-1.5 text-[10px] font-mono tracking-widest text-[var(--signal-red)] border border-[var(--signal-red)]/20 hover:border-[var(--signal-red)]/60 hover:bg-[var(--signal-red)]/10 rounded-[var(--radius-chip)] transition-all flex items-center space-x-1.5 cursor-pointer uppercase font-bold"
                    >
                        <span>LOGOUT</span>
                    </button>
                </div>
            </header>
            {/* Smart Contract & Compliance Overview Header */}
            <div className="bg-[var(--panel-raised)] border-b border-[var(--hairline)] px-6 py-3 flex items-center justify-between z-30">
                <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-2 text-[10px] font-mono">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-white/60 uppercase">SMART CONTRACT:</span>
                        <span className="text-[var(--slick-teal)] font-bold">0x71b2D14704E94833215264b971a8069502A562B3</span>
                    </div>
                    <div className="hidden md:flex items-center space-x-2 text-[10px] font-mono">
                        <span className="text-white/40">NETWORK:</span>
                        <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold text-[9px]">
                            POLYGON AMOY (80002)
                        </span>
                    </div>
                    <div className="hidden lg:flex items-center space-x-2 text-[10px] font-mono">
                        <span className="text-white/40">IPFS MERKLE PROOFS:</span>
                        <span className="text-emerald-400 font-bold text-[9px]">DECENTRALIZED ACTIVE</span>
                    </div>
                </div>

                <div className="flex items-center space-x-4 text-xs font-mono">
                    <div>
                        <span className="text-white/40 text-[9px] uppercase mr-1.5">ACTIVE PORT HOLDS:</span>
                        <span className="text-red-400 font-bold">{fleetVessels.filter(v => enforcedList.some(e => e.vesselMmsi === v.mmsi && payments[e.id] !== 'paid')).length}</span>
                    </div>
                    <div>
                        <span className="text-white/40 text-[9px] uppercase mr-1.5">TOTAL FINES IMPOSED:</span>
                        <span className="text-amber-400 font-bold text-sm">
                            ${(enforcedList.reduce((sum, c) => sum + c.fineAmount, 0) / 1000).toFixed(0)}k USD
                        </span>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <main className="flex-1 flex overflow-hidden p-6 gap-6 relative z-10">
                {/* Left Panel: Fleet Status Panel */}
                <div className="w-[380px] flex flex-col space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="font-display font-semibold text-xs tracking-wider text-[var(--foam-dim)] uppercase">Registered Fleet Vessels ({fleetVessels.length})</h2>
                        <span className="text-[9px] font-mono text-cyan-400">BLUE DOTS</span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                        {fleetVessels.map(vessel => {
                            const hasActiveHold = enforcedList.some(e => e.vesselMmsi === vessel.mmsi && payments[e.id] !== 'paid') || vessel.status === 'HOLD';
                            const vesselFine = enforcedList.find(e => e.vesselMmsi === vessel.mmsi);
                            return (
                                <Card key={vessel.mmsi} className={`p-4 border transition-all duration-200 ${hasActiveHold ? 'border-dashed border-[var(--signal-red)] bg-[rgba(225,72,60,0.04)] shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-white/10 bg-white/5'}`}>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center space-x-2 text-[9px] font-mono text-[var(--foam-dim)] tracking-wider uppercase mb-1">
                                                <Anchor size={11} className={hasActiveHold ? "text-[var(--signal-red)]" : "text-[var(--slick-teal)]"} />
                                                <span>MMSI: {vessel.mmsi}</span>
                                            </div>
                                            <h4 className="font-display font-bold text-sm text-white flex items-center space-x-1.5">
                                                <span>{vessel.name}</span>
                                            </h4>
                                            <p className="text-[10px] font-mono text-[var(--foam-dim)] opacity-65">{vessel.type}</p>
                                            {vesselFine && (
                                                <div className="mt-2 text-[10px] font-mono text-amber-400 font-bold">
                                                    Statutory Fine: ${vesselFine.fineAmount.toLocaleString()} USD
                                                </div>
                                            )}
                                        </div>
                                        <Badge variant={hasActiveHold ? 'red' : 'teal'}>
                                            {hasActiveHold ? 'PORT HOLD ACTIVE' : 'CLEAR'}
                                        </Badge>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                </div>

                {/* Right Panel: Citations Ledger */}
                <div className="flex-1 flex flex-col space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="font-display font-semibold text-xs tracking-wider text-[var(--foam-dim)] uppercase">
                            Smart Contract Citations & Fines Ledger ({enforcedList.length})
                        </h2>
                        <span className="text-[9px] font-mono text-purple-300 bg-purple-900/30 px-2 py-0.5 rounded border border-purple-500/30">
                            SOLIDITY ON-CHAIN PROOFS
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                        {enforcedList.length === 0 ? (
                            <div className="h-60 border border-white/5 bg-white/2 flex flex-col items-center justify-center rounded-[var(--radius-card)] text-center p-6 text-[var(--foam-dim)] font-mono">
                                <CheckCircle2 size={32} className="text-[var(--slick-teal)] mb-3 opacity-60" />
                                <span className="text-xs font-semibold text-white mb-2 uppercase">NO STATUTORY CITATIONS FOUND</span>
                                <span className="text-[9px] opacity-60">Your fleet MMSIs have no active fine events recorded on-chain.</span>
                            </div>
                        ) : (
                            enforcedList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(citation => {
                                const currentPaymentStatus = payments[citation.id] || 'pending';

                                return (
                                    <Card key={citation.id} className="p-5 border border-white/10 bg-white/3 flex flex-col justify-between space-y-4 relative overflow-hidden shadow-xl">
                                        <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-red-500" />
                                        {currentPaymentStatus === 'paid' && <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-[var(--slick-teal)]" />}

                                        <div className="flex justify-between items-start pl-2">
                                            <div className="space-y-1">
                                                <div className="flex items-center space-x-2 text-[9px] font-mono tracking-wider uppercase text-[var(--foam-dim)]">
                                                    <span className="text-red-400 font-bold uppercase flex items-center">
                                                        <ShieldAlert size={10} className="inline mr-1" />
                                                        STATUTORY FINE ANCHORED
                                                    </span>
                                                    <span>·</span>
                                                    <span>MMSI: {citation.vesselMmsi} ({citation.vesselName})</span>
                                                </div>
                                                <h3 className="font-display font-bold text-base text-white">Incident Ref: {citation.id}</h3>
                                                <p className="text-[10px] font-mono text-[var(--foam-dim)]">
                                                    Fined Date: {new Date(citation.timestamp).toLocaleString()}
                                                </p>
                                            </div>

                                            <div className="text-right">
                                                <span className="text-[9px] font-mono text-[var(--foam-dim)] uppercase block">Imposed Fine Amount</span>
                                                <span className="text-2xl font-display font-black text-[var(--signal-red)]">${citation.fineAmount.toLocaleString()} USD</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3 bg-[var(--abyss)] p-3.5 rounded-[var(--radius-card)] border border-[var(--hairline)] pl-5 text-[10px] font-mono text-[var(--foam-dim)]">
                                            <div>
                                                <div className="text-[8px] opacity-40 uppercase mb-0.5">Polygon Block Number</div>
                                                <span className="text-purple-300 font-bold">#{citation.blockNumber}</span>
                                            </div>
                                            <div className="truncate">
                                                <div className="text-[8px] opacity-40 uppercase mb-0.5">Smart Contract Tx Hash</div>
                                                <span className="text-white hover:text-[var(--slick-teal)] underline cursor-pointer font-mono" title={citation.txHash}>
                                                    {citation.txHash.slice(0, 14)}...
                                                </span>
                                            </div>
                                            <div className="truncate">
                                                <div className="text-[8px] opacity-40 uppercase mb-0.5">Forensic IPFS Dossier CID</div>
                                                <a
                                                    href={`https://gateway.ipfs.io/ipfs/${citation.ipfsCid}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-[var(--slick-teal)] underline hover:text-white flex items-center font-mono"
                                                >
                                                    {citation.ipfsCid.slice(0, 12)}...
                                                    <Link2 size={9} className="ml-1" />
                                                </a>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-2 pl-2 border-t border-[var(--hairline)]">
                                            <div className="flex items-center space-x-2 text-[10px] font-mono">
                                                <span className="opacity-50">Port Clearance:</span>
                                                {currentPaymentStatus === 'paid' ? (
                                                    <span className="text-[var(--slick-teal)] font-bold uppercase flex items-center">
                                                        <CheckCircle2 size={12} className="mr-1 inline" /> PAID ON-CHAIN & RELEASED
                                                    </span>
                                                ) : (
                                                    <span className="text-[var(--signal-red)] font-bold uppercase animate-pulse flex items-center">
                                                        <ShieldAlert size={12} className="mr-1 inline" /> PORT CLEARANCE REVOKED (HOLD)
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center space-x-2">
                                                {currentPaymentStatus === 'pending' && (
                                                    <button
                                                        onClick={() => handlePayment(citation.id)}
                                                        className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white text-[10px] font-bold tracking-wider rounded-[var(--radius-chip)] cursor-pointer transition-all flex items-center uppercase space-x-1 shadow-[0_0_12px_rgba(239,68,68,0.3)]"
                                                    >
                                                        <DollarSign size={11} />
                                                        <span>Settle Fine Notice</span>
                                                    </button>
                                                )}

                                                {currentPaymentStatus === 'paying' && (
                                                    <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-[var(--radius-chip)] text-[10px] font-mono text-[var(--foam-dim)] flex items-center space-x-1.5 uppercase">
                                                        <Loader2 size={12} className="animate-spin text-[var(--slick-teal)]" />
                                                        <span>Broadcasting Settlement Tx...</span>
                                                    </div>
                                                )}

                                                {currentPaymentStatus === 'paid' && (
                                                    <div className="px-4 py-2 border border-[var(--slick-teal)]/40 text-[var(--slick-teal)] text-[10px] font-bold rounded-[var(--radius-chip)] flex items-center uppercase space-x-1 bg-[rgba(0,242,254,0.08)]">
                                                        <CheckCircle2 size={11} />
                                                        <span>Settlement Finalized On-Chain</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};
export default VesselDashboard;
