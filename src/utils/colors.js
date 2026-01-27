const palette = [
    '#4ef1ff',
    '#ff9a62',
    '#9b6bff',
    '#6fffc8',
    '#ff6f91',
    '#f8d477',
    '#66f2a2',
    '#b992ff',
    '#ff7ad9',
    '#ffd966',
    '#7ad6ff',
    '#9ff7c1',
    '#ffb6c1',
    '#c4a2ff'
];
const categoryAccentMap = {
    'DeFi': '#66f2a2',
    'Perps/Trading': '#ff9a62'
};
export const getCategoryColor = (category) => {
    const preset = categoryAccentMap[category];
    if (preset) {
        return preset;
    }
    const hash = category
        .split('')
        .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return palette[hash % palette.length];
};
export const CATEGORY_PALETTE = palette;
export const CATEGORY_ACCENTS = categoryAccentMap;
