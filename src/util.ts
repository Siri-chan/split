/* eslint @typescript-eslint/no-explicit-any:0 */

export const clone = (obj: any | any[]): any | any[] => {
	if (null == obj || "object" != typeof obj) return obj;
	if (obj instanceof Date) {
		const copy = new Date();
		copy.setTime(obj.getTime());
		return copy;
	}
	if (obj instanceof Array) {
		const copy: any[] = [];
		for (let i = 0, len = obj.length; i < len; i++) {
			copy[i] = clone(obj[i]);
		}
		return copy;
	}
	if (obj instanceof Object) {
		const copy = {};
		for (const attr in obj) {
			if (Object.prototype.hasOwnProperty.call(obj, attr)) {
				copy[attr] = clone(obj[attr]);
			}
		}
		return copy;
	}

	return undefined;
};

export const parseBool = (bool: any): boolean => {
	return !(bool == "false" || bool == 0 || bool == "0");
};

export const getMs = (time: string): number => {
	// I think this is a localization hack.
	time = time.replace(",", ".");

	// If time is < 1 min, we can just parse it as a float and mul by 1000.
	if (!time.match(/:/)) {
		return 1000 * (parseFloat(time) || 0);
	}

	// Otherwise, remove the : and . s from the time
	// though i thing this regex actually just matches everything because of the `*`?
	// should console.log this and like... check at some point
	time = time.replace(/[^\d.:]*/gm, "");

	let ms = 0;

	// This used to just be `time = time.split(...)`, but Typescript doesn't like that.
	const time_arr = time.split(":");
	time_arr.reverse();

	for (let i = 0; i < time_arr.length; i++) {
		ms +=
			parseFloat(time_arr[i]) *
			1000 *
			// Original code doesn't ever use a time measure above hours, so we just panic and throw out a NaN
			(i < 3 ? Math.pow(60, i) : NaN);
	}

	/*
	Old Code:

  var multi = [1, 60, 60 * 60];
  for (var i = time_arr.length - 1; i >= 0; i--) {
	  console.log({
		time_str: time_arr[i], ms: ms,
	  })
	  // This parse is also only required because Typescript
    ms += 1000 * multi[i] * parseFloat(time_arr[i]);
  }
  */

	return ms;
};

export const keymap: Record<string, number> = {
	backspace: 8,
	command: 91,
	tab: 9,
	clear: 12,
	enter: 13,
	shift: 16,
	ctrl: 17,
	alt: 18,
	capslock: 20,
	escape: 27,
	esc: 27,
	space: 32,
	pageup: 33,
	pgup: 33,
	pagedown: 34,
	pgdn: 34,
	end: 35,
	home: 36,
	left: 37,
	up: 38,
	right: 39,
	down: 40,
	del: 46,
	comma: 188,
	f1: 112,
	f2: 113,
	f3: 114,
	f4: 115,
	f5: 116,
	f6: 117,
	f7: 118,
	f8: 119,
	f9: 120,
	f10: 121,
	f11: 122,
	f12: 123,
	",": 188,
	".": 190,
	"/": 191,
	"`": 192,
	"-": 189,
	"=": 187,
	";": 186,
	"[": 219,
	"\\": 220,
	"]": 221,
	"'": 222
};

export const key = (name: string): number => {
	return (
		keymap[String(name).toLowerCase()] ||
		String(name).toUpperCase().charCodeAt(0)
	);
};

export const rnd = (num: number): number => {
	return parseFloat(num.toFixed(3));
};
