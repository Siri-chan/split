import {options} from '../options';

export const ttime = function (time: number): string {
	time = Math.abs(time);
	const s = (time / 1000) % 60;
	const m = Math.floor((time / (1000 * 60)) % 60);
	const h = Math.floor((time / (1000 * 60 * 60)) % 24);
	let newTime =
		h +
		":" +
		m +
		":" +
		(options.precision ? s.toFixed(options.precision) : Math.floor(s));
	if (options.trim) {
		newTime = newTime.replace(/^([0:]*(?!\.))/, "");
	}
	newTime = newTime.replace(/(:(?=\d(?!\d)))/g, ":0");
	if (options.precision) {
		newTime = newTime.replace(".", "<span>.") + "</span>";
	}
	if (newTime == "") {
		newTime = "0";
	}
	return newTime;
};
