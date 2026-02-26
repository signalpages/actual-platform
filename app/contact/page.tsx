export default function ContactPage() {
    return (
        <div className="max-w-7xl mx-auto px-6 py-16">
            <h1 className="text-6xl font-black uppercase tracking-tighter text-slate-900 leading-none mb-4">
                Contact Editorial
            </h1>

            <p className="text-lg text-slate-600 mb-12 max-w-2xl leading-relaxed">
                Request product coverage or report a correction.<br />
                Submissions are reviewed and prioritized; we may not reply to every message.
            </p>

            <div className="grid lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden p-8">
                    <form action="https://formspree.io/f/xzdaoerj" method="POST" className="space-y-6">

                        <div className="grid lg:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    Topic <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="topic"
                                    defaultValue=""
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all appearance-none"
                                    required
                                >
                                    <option value="" disabled>Select a reason...</option>
                                    <option value="coverage">Request Product Coverage</option>
                                    <option value="correction">Report a Correction</option>
                                    <option value="partnership">Partnership Inquiry</option>
                                    <option value="general">General Message</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    Email Address <span className="text-slate-300 font-normal">(Optional)</span>
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    placeholder="Enter your email"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                Subject / Product / URL <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="subject"
                                placeholder="What is this regarding?"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                Message / Details <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                name="message"
                                rows={6}
                                placeholder="Provide as much context, links, or documentation as possible..."
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all resize-none"
                                required
                            ></textarea>
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-slate-900 text-white rounded-xl py-4 text-center text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-600 shadow-lg shadow-blue-900/10 transition-all font-sans"
                        >
                            Submit to Editorial
                        </button>
                    </form>
                </div>

                {/* RIGHT: Editorial Process Box */}
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-8 h-full">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">
                            How Editorial Review Works
                        </div>
                        <ul className="space-y-6 text-sm font-medium text-slate-600">
                            <li className="flex gap-4">
                                <span className="text-slate-400 mt-0.5">—</span>
                                Submissions are logged and reviewed.
                            </li>
                            <li className="flex gap-4">
                                <span className="text-slate-400 mt-0.5">—</span>
                                Corrections require documented sources.
                            </li>
                            <li className="flex gap-4">
                                <span className="text-slate-400 mt-0.5">—</span>
                                Coverage requests are prioritized based on demand.
                            </li>
                            <li className="flex gap-4">
                                <span className="text-slate-400 mt-0.5">—</span>
                                Approved updates appear in rankings after validation.
                            </li>
                        </ul>
                        {/* Zero backend email infrastructure. All submissions via Formspree native POST. */}
                    </div>
                </div>
            </div>
        </div>
    );
}
