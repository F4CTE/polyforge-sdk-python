import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router';
import { SearchX } from 'lucide-react';
export function Component() {
    return (_jsx("div", { className: "flex items-center justify-center min-h-screen bg-pf-base", children: _jsxs("div", { className: "text-center", children: [_jsx(SearchX, { className: "size-16 text-pf-text-muted mx-auto mb-4" }), _jsx("h1", { className: "text-6xl font-bold text-pf-text-muted", children: "404" }), _jsx("p", { className: "text-pf-text-muted mt-4 text-lg", children: "Page not found" }), _jsx(Link, { to: "/markets", className: "inline-block mt-6 px-4 py-2 bg-pf-cyan-500 text-black rounded-pf hover:bg-pf-cyan-400 transition-colors focus:outline-none focus:ring-2 focus:ring-pf-cyan-500/40", children: "Go to Markets" })] }) }));
}
