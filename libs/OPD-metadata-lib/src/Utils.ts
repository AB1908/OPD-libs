export interface KeyValuePair<T, U> {
	key: T;
	value: U;
}

export function traverseObject(path: string, o: any): any {
	let pathParts: string[] = parsePath(path);
	return traverseObjectByPath(pathParts, o);
}

export function traverseObjectToParent(path: string, o: any): { parent: KeyValuePair<string[], any>; child: KeyValuePair<string, any> } {
	let pathParts: string[] = parsePath(path);

	if (pathParts[0] === '') {
		throw new OPDTraversalError('can not traverse to parent on self reference');
	}

	let parentPath = pathParts.slice(0, -1);
	let childKey: string = pathParts.at(-1) ?? '';
	let parentObject = traverseObjectByPath(parentPath, o);

	return {
		parent: { key: parentPath, value: parentObject },
		child: { key: childKey, value: parentObject[childKey] },
	};
}

export function traverseObjectByPath(pathParts: string[], o: any): any {
	for (const pathPart of pathParts) {
		if (pathPart === '') {
			return o;
		}
		if (o === undefined) {
			return undefined;
		}
		o = o[pathPart];
	}

	return o;
}

export function parsePath(path: string): string[] {
	path = path.replace(/'/g, '"');
	validatePath(path);
	return path
		.split('.')
		.map(x =>
			x.split('[').map(y => {
				if (y.endsWith(']')) {
					y = y.slice(0, -1);
				}
				if (y.startsWith('"') && y.endsWith('"')) {
					y = y.slice(1, -1);
				}
				return y;
			})
		)
		.flat();
}

export function validatePath(path: string): void {
	const allowedCharacters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890_.[]"';
	const numbers = '0123456789';
	const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

	let insideStringBrackets: boolean = false;
	let insideNumberBrackets: boolean = false;

	for (let i = 0; i < path.length; i++) {
		const char = path[i];
		const nextChar = path[i + 1];

		if (!allowedCharacters.includes(char)) {
			throw new OPDTraversalError(`Invalid character "${char}" at position ${i} in "${path}", character ${char} is not a valid character`);
		}

		// if char is a dot
		if (char === '.') {
			// a dot may not be at the beginning of a path
			if (i === 0) {
				throw new OPDTraversalError(`Invalid character "${char}" at position ${i} in "${path}", path may not start with a dot`);
			}

			// the thing following a dot must be a valid variable name, so it must start with a letter or an underscore
			if (!(letters.includes(nextChar) || nextChar === '_')) {
				throw new OPDTraversalError(`Invalid character "${nextChar}" at position ${i + 1} in "${path}", expected a letter or underscore to follow a dot`);
			}
		}

		// bracket enter condition
		if (char === '[') {
			if (numbers.includes(nextChar)) {
				// the bracket is used to access an array
				insideNumberBrackets = true;
				continue; // skip rest of current char
			} else if (nextChar === '"') {
				// the bracket is used to access a property, property name must be wrapped in quotes
				if (!(letters.includes(path[i + 2]) || path[i + 2] === '_')) {
					// make sure string inside of brackets does not start with a number or dot
					throw new OPDTraversalError(`Invalid character "${path[i + 2]}" at position ${i + 2} in "${path}", expected a letter or underscore to follow a "`);
				}
				insideStringBrackets = true;
				i += 1; // skip next char
				continue; // skip rest of current char
			} else {
				throw new OPDTraversalError(`Invalid character "${nextChar}" at position ${i + 1} in "${path}", expected number or " to follow a [`);
			}
		}

		// string bracket exit condition
		if (insideStringBrackets && char === '"') {
			if (nextChar === ']') {
				insideStringBrackets = false;
				i += 1; // skip next char
				continue; // skip rest of current char
			} else {
				throw new OPDTraversalError(`Invalid character "${nextChar}" at position ${i + 1} in "${path}", expected ] to follow "`);
			}
		}

		// number bracket exit condition
		if (insideNumberBrackets && char === ']') {
			insideNumberBrackets = false;
			continue;
		}

		if (insideStringBrackets && (char === '.' || char === ']' || char === '[')) {
			throw new OPDTraversalError(`Invalid character "${char}" at position ${i} in "${path}", expected letter, number or underscore expected inside of string`);
		}

		if (insideNumberBrackets && !numbers.includes(char)) {
			throw new OPDTraversalError(`Invalid character "${char}" at position ${i} in "${path}", number expected inside of brackets`);
		}

		if (!(insideNumberBrackets || insideStringBrackets)) {
			if (char === ']') {
				throw new OPDTraversalError(`Invalid character "${char}" at position ${i} in "${path}", expected [ to proceed`);
			}
		}
	}
}

export class OPDTraversalError extends Error {
	constructor(message: string) {
		super(message);
	}
}
