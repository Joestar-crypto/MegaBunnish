import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { useConstellation } from '../state/constellation';
const SOCIAL_LINKS = [
    { key: 'site', label: 'Website', icon: '/icons/globe.svg' },
    { key: 'twitter', label: 'X', icon: '/icons/x.svg' },
    { key: 'discord', label: 'Discord', icon: '/icons/discord.svg' },
    { key: 'telegram', label: 'Telegram', icon: '/icons/telegram.svg' },
    { key: 'nft', label: 'NFT', icon: '/icons/nft.svg' }
];
export const ProjectDetailDrawer = () => {
    const { projects, selectedProjectId, selectProject } = useConstellation();
    const project = useMemo(() => projects.find((entry) => entry.id === selectedProjectId), [projects, selectedProjectId]);
    const isVisible = Boolean(project);
    return (_jsx("aside", { className: `detail-drawer ${isVisible ? 'is-active' : 'is-hidden'}`, "aria-hidden": !isVisible, children: project ? (_jsxs("div", { className: "drawer-content", children: [_jsxs("header", { children: [_jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: project.primaryCategory }), _jsx("h2", { children: project.name })] }), _jsx("button", { className: "ghost", type: "button", onClick: () => selectProject(null), children: "Close" })] }), _jsx("p", { className: "summary", children: project.summary }), _jsxs("section", { children: [_jsx("h3", { children: "Categories" }), _jsx("div", { className: "badge-row", children: project.categories.map((category) => (_jsx("span", { className: "badge", children: category }, category))) })] }), _jsxs("section", { children: [_jsx("h3", { children: "Access" }), _jsx("div", { className: "icon-link-row", children: SOCIAL_LINKS.filter(({ key }) => Boolean(project.links[key])).map(({ key, label, icon }) => (_jsxs("a", { className: "icon-link", href: project.links[key], target: "_blank", rel: "noreferrer", "aria-label": label, children: [_jsx("img", { src: icon, alt: "", "aria-hidden": true }), _jsx("span", { children: label })] }, key))) })] }), _jsxs("section", { children: [_jsx("h3", { children: "Active incentives" }), project.incentives.length === 0 ? (_jsx("p", { className: "muted", children: "Nothing live right now. Check back soon." })) : (_jsx("ul", { className: "incentive-list", children: project.incentives.map((incentive) => (_jsxs("li", { children: [_jsx("h4", { children: incentive.title }), _jsx("p", { children: incentive.reward }), _jsxs("span", { className: "muted", children: ["Ends ", new Date(incentive.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })] })] }, incentive.id))) }))] })] })) : null }));
};
