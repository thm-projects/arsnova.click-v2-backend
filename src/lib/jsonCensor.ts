export function jsonCensor(data: any): any {
  let i = 0;

  return (key, value) => {
    if (i !== 0 && typeof(data) === 'object' && typeof(value) === 'object' && data === value) {
      return '[Circular]';
    }

    if (i >= 29) {// seems to be a harded maximum of 30 serialized objects?
      return '[Unknown]';
    }

    ++i; // so we know we aren't using the original object anymore

    return value;
  };
}
