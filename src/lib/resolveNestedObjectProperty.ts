export const resolvePath = (object, path, defaultValue) => path
.split('.')
.reduce((o, p) => o ? o[p] : defaultValue, object);

export const setPath = (object, path, value) => path
.split('.')
.reduce((o, p) => o[p] = path.split('.').pop() === p ? value : o[p] || {}, object);
