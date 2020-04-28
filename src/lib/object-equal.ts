import { arraysEqual } from './array-equal';

export function objectEqual(a: object, b: object): boolean {
  if (a === b) {
    return true;
  }

  // Create arrays of property names
  const aProps = Object.getOwnPropertyNames(a);
  const bProps = Object.getOwnPropertyNames(b);

  // If number of properties is different,
  // objects are not equivalent
  if (aProps.length !== bProps.length) {
    return false;
  }

  // If values of same property are not equal,
  // objects are not equivalent
  if (!arraysEqual(a as any, b as any)) {
    return false;
  }

  // If we made it this far, objects
  // are considered equivalent
  return true;
}
