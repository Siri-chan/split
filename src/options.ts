/* eslint @typescript-eslint/no-explicit-any:0 */

import { getCurrentWindow } from '@tauri-apps/api/window';

import { splits, draw, _save, RESET, STOPPED } from "./split";
import { clone } from "./util";

import { ttime } from './util/ttime';

import type { Result } from "./result";

// NOTE: These are stored in localStorage right now but it might be worth moving it.
interface Options {
	ontop: boolean;
	precision: number;
	trim: boolean;
	offset: number;
	interval: number;
	drawinterval: number;
	autoadd: boolean;
	autosave: boolean;
	title: string;
	attempts: number;
	splits: number;
	graph: boolean;
	toolbar: boolean;
	// TODO: This was stringified before - double check this works as `number`
	iconSize: number;
	// NOTE: This particularly expects a base64 string - maybe I should create a type Base64String that is just string for clarity?
	icon: string;
	history: number;
	global_split: string;
	global_stop: string;
	global_reset: string;
	global_pause: string;
	global_undo: string;
	local_split: string;
	local_stop: string;
	local_reset: string;
	local_pause: string;
	local_undo: string;
	// NOTE: I don't know if I can dynamically resize and then remember between sessions - need to figure that out.
	width: number;
	height: number;
	// NOTE: It's also bad practise to set a window position, maybe I straight remove these?
	x: number;
	y: number;
	zoom: number;
	// Should I do something more nuanced than storing custom css in a string in localStorage?
	css: string;
}

// TODO: Should these be here or in Rust? IDK
export const optionDefaults: Options = {
	ontop: true,
	precision: 1,
	trim: true,
	offset: 0,
	interval: 100,
	drawinterval: 100,
	autoadd: false,
	autosave: true,
	title: "game title",
	attempts: 0,
	splits: 0,
	graph: true,
	toolbar: true,
	iconSize: 32,
	// NOTE: Prettier will try to format this into sentence case, which is bad.
	icon:
		// prettier-ignore
		"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAZiS0dEAAAAAAAA+UO7fwAAASRJREFUWIXlls0OwiAQhD+Mifaiz9gn6zPqpfa0HqARkP+qNHFODd1dprMDW/h3qA258olahw0EPoIW1gIgAixm5QTqVamq5rGBgMYC3M3zpblK/xZ0J1DTL7f3NytbgCtNXqj3wLr51VsPrX2FAHojdXaX5JHNCt4b3T1QosB772NS34wS2gvOF0/TxDzPAAzDwDiOAjUKrOc+ZS1lYpZETCAlB63AA+fiCXog/N4+K297d/dAioAAIuJ9XQnuOkfkVcd6q7CUzytg3/k1KPRC+zCqR9Bv3T0QYuWe+5j8/ghOxSVmRFyB1t77yHihzQO5e6ACu/JAfN77WOe/jZL4gBfiBL6BEgI/xD5mQfk0NPok/vlK4xx0V6AG/lTbGgfsQIEnrwNkcZmOLQwAAAAASUVORK5CYII=",
	history: 10,
	global_split: "ctrl+f12",
	global_stop: "ctrl+f11",
	global_reset: "ctrl+f10",
	global_pause: "ctrl+f9",
	global_undo: "ctrl+f8",
	local_split: "f12",
	local_stop: "f11",
	local_reset: "f10",
	local_pause: "f9",
	local_undo: "f8",
	width: 320,
	height: 720,
	x: 300,
	y: 300,
	zoom: 1,
	css: ""
};

export const loadOptions = (): Options => {
	const stored = JSON.parse(localStorage.options || "{}");
	const opts = clone(optionDefaults);
	for (const key in stored) {
		opts[key] = clone(stored[key]);
	}
	return opts;
};

export let options = loadOptions();

export const optionHelp: Record<string, string> = {
	ontop: "Always on top, boolean",
	zoom: "Zoom level, 0.1 .. 5",
	precision: "Number of decimals, 0 .. 3",
	trim: "Trim leading zeroes, boolean",
	interval: "Timer update interval, ms",
	drawinterval: "Graph update interval, ms",
	autoadd: "Automatically add new splits, boolean",
	autosave: "Automatically save personal best and best segments on reset",
	offset: "Timer start offset, ms",
	splits: "Number of empty splits to create by default",
	graph: "Show the graph, boolean",
	toolbar: "Show the toolbar, boolean",
	iconsize: "Split icon size, px",
	global_split: "Global hotkey: Start / Split",
	global_stop: "Global hotkey: Stop / Save times",
	global_reset: "Global hotkey: Reset / Clear (hold)",
	global_pause: "Global hotkey: Pause / Options",
	global_undo: "Global hotkey: Undo / Import / Export",
	local_split: "Local hotkey: Start / Split",
	local_stop: "Local hotkey: Stop / Save times",
	local_reset: "Local hotkey: Reset / Clear (hold)",
	local_pause: "Local hotkey: Pause / Options",
	local_undo: "Local hotkey: Undo / Import / Export"
};

// NOTE: Passing in `v` is fine because it's an object so it's passed by reference.
export const setOption: Record<
	string,
	(value: string | number | boolean, v?: any) => Result<void, string>
> = {
	ontop: function (value) {
		if (typeof value != "boolean")
			return {
				err: "setOption.precision() called with incorrect value type"
			};
		
		_setOption("ontop", value);
		if (window.__TAURI__) {
			getCurrentWindow().setAlwaysOnTop(options.ontop).finally(()=>{});
			return {ok: undefined}
		}
	},
	precision: (value, v) => {
		if (!v) return { err: "v not passed to setOption.precision()" };
		if (typeof value != "number")
			return {
				err: "setOption.precision() called with incorrect value type"
			};

		_setOption("precision", Math.round(value));
		if (options.precision < 0 || options.precision > 3) {
			_setOption("precision", 1);
		}
		for (const i in splits) {
			$(".split[data-id=" + i + "] .seg").html(ttime(splits[i].bestseg));
			$(".split[data-id=" + i + "] .time").html(ttime(splits[i].best));
		}
		v.timer.html(ttime(v.time));
		return { ok: undefined };
	},
	offset: (value, v) => {
		if (!v) return { err: "v not passed to setOption.offset()" };
		if (typeof value != "number")
			return {
				err: "setOption.offset() called with incorrect value type"
			};

		_setOption("offset", Math.round(value));
		if (v.state == RESET || v.state == STOPPED) {
			$("#timer").html(ttime(options.offset));
		}
		return { ok: undefined };
	},
	splits: value => {
		if (typeof value != "number")
			return {
				err: "setOption.splits() called with incorrect value type"
			};
		return { ok: _setOption("splits", Math.round(value)) };
	},
	interval: value => {
		if (typeof value != "number")
			return {
				err: "setOption.interval() called with incorrect value type"
			};
		return { ok: _setOption("interval", Math.round(value)) };
	},
	drawinterval: value => {
		if (typeof value != "number")
			return {
				err: "setOption.drawinterval() called with incorrect value type"
			};
		return { ok: _setOption("drawinterval", Math.round(value)) };
	},
	autoadd: value => {
		return { ok: _setOption("autoadd", value) };
	},
	autosave: value => {
		return { ok: _setOption("autosave", value) };
	},
	trim: (value, v) => {
		if (!v) return { err: "v not passed to setOption.trim()" };
		if (typeof value != "boolean")
			return { err: "setOption.trim() called with incorrect value type" };
		_setOption("trim", value);
		if (v.state == RESET || v.state == STOPPED) {
			$("#timer").html(ttime(options.offset));
		}
		return { ok: undefined };
	},
	title: function (value, v) {
		if (!v) return { err: "v not passed to setOption.title()" };
		if (typeof value != "string")
			return {
				err: "setOption.title() called with incorrect value type"
			};
		_setOption("title", value);

		if (v.title) v.title.html(value);
		return { ok: undefined };
	},
	attempts: function (value, v) {
		if (!v) return { err: "v not passed to setOption.attempts()" };
		_setOption("attempts", value);
		if (v.attempts) v.attempts.html(value);
		return { ok: undefined };
	},
	graph: function (value, v) {
		if (!v) return { err: "v not passed to setOption.graph()" };
		if (typeof value != "boolean")
			return { err: "setOption.trim() called with incorrect value type" };

		_setOption("graph", value);

		if (options.graph) {
			$("#graph").slideDown(function () {
				if (v.plot) {
					v.plot.resize();
				}
				v.drawinter = setInterval(draw, options.drawinterval);
			});
		} else {
			clearInterval(v.drawinter);
			v.drawinter = 0;
			$("#graph").slideUp();
		}
		return { ok: undefined };
	},
	toolbar: function (value) {
		_setOption("toolbar", value);
		// @ts-expect-error __TAURI__ is set when in Tauri, but TS doesn't see the variable being injected.
		if (!window.__TAURI__) return { ok: undefined };
		if (options.toolbar) {
			$("#bar").slideDown();
		} else {
			$("#bar").slideUp();
		}
		return { ok: undefined };
	},
	iconSize: value => {
		if (typeof value != "number")
			return {
				err: "setOption.iconSize() called with incorrect value type"
			};
		$(".icon").height(options.iconSize).width(options.iconSize);
		if (options.iconSize > 16) {
			$(".name,.seg,.time")
				.css("line-height", String(options.iconSize) + "px")
				.css("height", String(options.iconSize) + "px");
		} else {
			$(".name,.seg,.time")
				.css("line-height", "16px")
				.css("height", "auto");
		}
		return { ok: undefined };
	},
	css: function (value) {
		if (typeof value != "string")
			return { err: "setOption.css() called with incorrect value type" };
		_setOption("css", value);
		$("style").html(options.css);
		return { ok: undefined };
	},
	local_split: value => {
		return { ok: _setOption("local_split", value) };
	},
	local_stop: value => {
		return { ok: _setOption("local_stop", value) };
	},
	local_pause: value => {
		return { ok: _setOption("local_pause", value) };
	},
	local_reset: value => {
		return { ok: _setOption("local_reset", value) };
	},
	local_undo: value => {
		return { ok: _setOption("local_undo", value) };
	}
};

export const _setOption = (key: string, value: string | number | boolean) => {
	if (typeof options[key] == typeof value) {
		options[key] = value;
		// We infinitely recurse if setting css.
		if (key !== "css")
			_save()
		return;
	}

	console.error(
		"options.setOption called with incorrectly typed value for key " + key
	);
	console.error(
		"typeof options[key] (" +
			typeof options[key] +
			") != typeof value (" +
			typeof value +
			")"
	);
};
export const setOptions = (opts?: Options) => {
	if (opts) {
		options = opts;
		_save()
		return;
	}
	options = optionDefaults;
	_save()
	return;
};

export const loadCss = () => {
	const file = $('<input type="file" accept=".css">');

	file.on("change", () => {
		const reader = new FileReader();

		reader.onloadend = () => {
			// NOTE: We can string cast, since we use `readAsText`, and we know reading has finished.
			options.css = String(reader.result);
		};

		// NOTE: We can up-cast here since we know we create an <input>
		const input = <HTMLInputElement>file[0];
		if (input.files != null) reader.readAsText(input.files[0]);
	});

	file.trigger("click");
};

