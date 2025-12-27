// © 2025 City Pave. All Rights Reserved.
// Filename: gantt-chart.js

const { useState, useEffect } = React;

export const GanttChart = ({ jobs, onJobUpdate }) => {
    const [viewMode, setViewMode] = useState('day'); // 'day' or 'week'
    const [currentDate, setCurrentDate] = useState(new Date());

    // Group jobs by Crew
    const crews = ['A', 'B', 'C', 'Unassigned'];
    const groupedJobs = crews.reduce((acc, crew) => {
        acc[crew] = jobs.filter(j => (j.assignedCrew || 'Unassigned') === crew && j.tentativeStartDate);
        return acc;
    }, {});

    const handleDragStart = (e, jobId) => {
        e.dataTransfer.setData("text/plain", jobId);
    };

    const handleDrop = (e, crew, dateStr) => {
        e.preventDefault();
        const jobId = e.dataTransfer.getData("text/plain");
        if (onJobUpdate) {
            onJobUpdate(jobId, crew, dateStr);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    // Generate dates for the timeline
    const getDates = () => {
        const dates = [];
        const start = new Date(currentDate);
        start.setDate(start.getDate() - 2); // Start 2 days ago
        for (let i = 0; i < 14; i++) { // Show 14 days
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            dates.push(d);
        }
        return dates;
    };

    const timelineDates = getDates();

    // --- CRITICAL PATH VISUALIZATION ---
    const [lines, setLines] = useState([]);

    useEffect(() => {
        // Calculate lines after render
        const newLines = [];
        const container = document.getElementById('gantt-scroll-container');
        if (!container) return;

        const containerRect = container.getBoundingClientRect();

        jobs.forEach(job => {
            if (job.dependsOn) {
                // Find Parent and Child Elements
                // We need unique IDs for the DOM elements. Let's assume we add id={`job-${job.id}`} to the job divs.
                const childEl = document.getElementById(`job-${job.id}`);
                const parentEl = document.getElementById(`job-${job.dependsOn}`);

                if (childEl && parentEl) {
                    const childRect = childEl.getBoundingClientRect();
                    const parentRect = parentEl.getBoundingClientRect();

                    // Calculate coordinates relative to the container
                    const x1 = parentRect.right - containerRect.left;
                    const y1 = parentRect.top + (parentRect.height / 2) - containerRect.top;
                    const x2 = childRect.left - containerRect.left;
                    const y2 = childRect.top + (childRect.height / 2) - containerRect.top;

                    newLines.push({ id: `${job.dependsOn}-${job.id}`, x1, y1, x2, y2 });
                }
            }
        });
        setLines(newLines);
    }, [jobs, currentDate, viewMode]); // Re-calc on updates

    return (
        <div className="flex flex-col h-full font-inter text-slate-800">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-slate-700">Schedule Timeline</h2>
                <div className="flex gap-2">
                    <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)))} className="px-3 py-1 bg-slate-100 rounded hover:bg-slate-200">&larr; Prev</button>
                    <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 bg-blue-50 text-blue-600 font-bold rounded hover:bg-blue-100">Today</button>
                    <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)))} className="px-3 py-1 bg-slate-100 rounded hover:bg-slate-200">Next &rarr;</button>
                </div>
            </div>

            <div id="gantt-scroll-container" className="flex-grow overflow-auto border border-slate-200 rounded-lg bg-white relative">

                {/* SVG Overlay for Critical Path */}
                <svg className="absolute inset-0 pointer-events-none z-30" style={{ width: '100%', height: '100%', minWidth: '1000px', minHeight: '500px' }}>
                    <defs>
                        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
                        </marker>
                    </defs>
                    {lines.map(line => (
                        <path
                            key={line.id}
                            d={`M ${line.x1} ${line.y1} C ${line.x1 + 20} ${line.y1}, ${line.x2 - 20} ${line.y2}, ${line.x2} ${line.y2}`}
                            stroke="#ef4444"
                            strokeWidth="2"
                            fill="none"
                            strokeDasharray="5,5"
                            markerEnd="url(#arrowhead)"
                        />
                    ))}
                </svg>

                {/* Header Row */}
                <div className="flex border-b border-slate-200 sticky top-0 bg-slate-50 z-10">
                    <div className="w-32 flex-shrink-0 p-3 font-bold text-slate-500 text-xs uppercase border-r border-slate-200 bg-slate-50 sticky left-0 z-20">Crew</div>
                    {timelineDates.map(date => (
                        <div key={date.toISOString()} className={`flex-1 min-w-[100px] p-2 text-center border-r border-slate-100 text-xs ${date.toDateString() === new Date().toDateString() ? 'bg-blue-50 font-bold text-blue-700' : 'text-slate-600'}`}>
                            {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </div>
                    ))}
                </div>

                {/* Crew Rows */}
                {crews.map(crew => (
                    <div key={crew} className="flex border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <div className="w-32 flex-shrink-0 p-4 font-bold text-slate-700 border-r border-slate-200 bg-white sticky left-0 z-10 flex items-center">
                            <div className={`w-3 h-3 rounded-full mr-2 ${crew === 'A' ? 'bg-red-500' : crew === 'B' ? 'bg-green-500' : crew === 'C' ? 'bg-indigo-500' : 'bg-gray-400'}`}></div>
                            Crew {crew}
                        </div>
                        {timelineDates.map(date => {
                            const dateStr = date.toISOString().split('T')[0];
                            const dayJobs = groupedJobs[crew]?.filter(j => j.tentativeStartDate === dateStr) || [];

                            return (
                                <div
                                    key={dateStr}
                                    className="flex-1 min-w-[100px] p-1 border-r border-slate-100 min-h-[80px] relative"
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, crew, dateStr)}
                                >
                                    {dayJobs.map(job => (
                                        <div
                                            key={job.id}
                                            id={`job-${job.id}`} // Added ID for line calculation
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, job.id)}
                                            className={`p-2 mb-1 rounded text-xs font-medium shadow-sm cursor-grab active:cursor-grabbing border-l-4 truncate relative z-20
                                                ${crew === 'A' ? 'bg-red-50 border-red-500 text-red-900' :
                                                    crew === 'B' ? 'bg-green-50 border-green-500 text-green-900' :
                                                        crew === 'C' ? 'bg-indigo-50 border-indigo-500 text-indigo-900' :
                                                            'bg-gray-100 border-gray-400 text-gray-700'}`}
                                            title={job.customerInfo?.name}
                                        >
                                            {job.customerInfo?.name}
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};
