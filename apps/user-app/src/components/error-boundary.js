import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
export class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error('[ErrorBoundary]', error, errorInfo);
    }
    handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.href = '/';
    };
    render() {
        if (this.state.hasError) {
            return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-pf-base p-6", children: _jsxs("div", { className: "max-w-md w-full text-center space-y-6", children: [_jsx("div", { className: "mx-auto size-16 rounded-full bg-pf-danger/10 flex items-center justify-center", children: _jsx(AlertTriangle, { className: "size-8 text-pf-danger" }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold text-pf-text mb-2", children: "Something went wrong" }), _jsx("p", { className: "text-sm text-pf-text-muted", children: "An unexpected error occurred. Please try refreshing the page." })] }), this.state.error && (_jsx("pre", { className: "text-xs text-left text-pf-danger bg-pf-danger/5 border border-pf-danger/10 rounded-pf p-3 overflow-auto max-h-32", children: this.state.error.message })), _jsxs("button", { onClick: this.handleReset, className: "inline-flex items-center gap-2 px-5 py-2.5 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 transition-colors", children: [_jsx(RefreshCw, { className: "size-4" }), "Reload Application"] })] }) }));
        }
        return this.props.children;
    }
}
