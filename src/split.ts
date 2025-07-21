import { invoke } from "@tauri-apps/api/core";
import { type } from "@tauri-apps/plugin-os";
import { listen } from "@tauri-apps/api/event";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { save } from "@tauri-apps/plugin-dialog";

import "jquery";
import $ from "jquery";
import "jquery.flot";

import "object.observe";

import { clone, getMs, key, parseBool, rnd, ttime } from "./util";

import {
	optionDefaults,
	optionHelp as help,
	loadCss,
	options,
	setOption,
	setOptions
} from "./options";

// TODO: Replace this with a string union
export const RESET = 0,
	RUNNING = 1,
	PAUSED = 2,
	STOPPED = 3;

let v = {
	inter: 0,
	drawinter: 0,
	n: 0,
	time: 0,
	state: RESET,
	pausestart: 0,
	start: 0,
	stop: 0,
	resets: 0,
	stops: 0,
	plot: false,
	history: []
};

let custom = null;

// TODO: Turn these into proper setters
const optionHandler = {
	/* TODO: Port always-on-top
	ontop: function (o) {
    options.ontop = parseBool(o);
    if (typeof win !== "undefined") {
      win.setAlwaysOnTop(options.ontop);
    }
  },
	*/
	/* TODO: Port the global hotkeys - Some WMs do this properly (anything X11, Plasma, maybe GNOME)
  global_split: function (o) {
    if (typeof gui !== "undefined") {
      gui.App.unregisterGlobalHotKey(v.shortcut_split);
      v.shortcut_split = new gui.Shortcut({
        key: o,
        active: function () {
          split();
        },
        failed: function (msg) {
          console.log(msg);
        },
      });
      gui.App.registerGlobalHotKey(v.shortcut_split);
    }
  },
  global_stop: function (o) {
    if (typeof gui !== "undefined") {
      gui.App.unregisterGlobalHotKey(v.shortcut_stop);
      v.shortcut_stop = new gui.Shortcut({
        key: o,
        active: function () {
          stop();
        },
        failed: function (msg) {
          console.log(msg);
        },
      });
      gui.App.registerGlobalHotKey(v.shortcut_stop);
    }
  },
  global_pause: function (o) {
    if (typeof gui !== "undefined") {
      gui.App.unregisterGlobalHotKey(v.shortcut_pause);
      v.shortcut_pause = new gui.Shortcut({
        key: o,
        active: function () {
          pause();
        },
        failed: function (msg) {
          console.log(msg);
        },
      });
      gui.App.registerGlobalHotKey(v.shortcut_pause);
    }
  },
  global_reset: function (o) {
    if (typeof gui !== "undefined") {
      gui.App.unregisterGlobalHotKey(v.shortcut_reset);
      v.shortcut_reset = new gui.Shortcut({
        key: o,
        active: function () {
          reset();
        },
        failed: function (msg) {
          console.log(msg);
        },
      });
      gui.App.registerGlobalHotKey(v.shortcut_reset);
    }
  },
  global_undo: function (o) {
    if (typeof gui !== "undefined") {
      gui.App.unregisterGlobalHotKey(v.shortcut_undo);
      v.shortcut_undo = new gui.Shortcut({
        key: o,
        active: function () {
          undo();
        },
        failed: function (msg) {
          console.log(msg);
        },
      });
      gui.App.registerGlobalHotKey(v.shortcut_undo);
    }
  },
	*/
	/* TODO: Do we need these? Window is movable and resizable, and preserves size alr.
	* Don't know if Tauri exposes window stuff either...
  width: function (o) {
    if (typeof in !== "undefined") {
      win.width = o;
    }
  },
  height: function (o) {
    if (typeof win !== "undefined") {
      win.height = o;
    }
  },
  x: function (o) {
    if (typeof win !== "undefined") {
      win.x = o;
    }
  },
  y: function (o) {
    if (typeof win !== "undefined") {
      win.y = o;
    }
  },
	*/
	zoom: function (o) {
		options.zoom = parseFloat(o) || 1;
		/* TODO: Port zoomLevel
		if (typeof win !== "undefined") {
			if (!isNaN(Math.log(options.zoom) / Math.log(1.2))) {
				win.zoomLevel = Math.log(options.zoom) / Math.log(1.2);
			}
		}
		*/
	}
};

var plotopt = {
	colors: ["#eee"],
	series: {
		lines: { show: true, lineWidth: 1 },
		points: { show: true, fill: false, radius: 3 },
		shadowSize: 0
	},
	legend: { show: false },
	xaxis: {
		show: true,
		tickColor: "#222",
		color: "#333",
		tickFormatter: function (t) {
			return ttime(t);
		}
	},
	yaxis: {
		show: true,
		ticks: [0],
		tickColor: "#222",
		color: "rgba(0,0,0,0)"
	},
	grid: { show: true, borderWidth: 0, borderColor: "#333", margin: 5 },
	interaction: { redrawOverlayInterval: 10000000 }
};

var updateStaticSegments = function () {
	if (!options.graph) {
		return;
	}
	v.data = [];
	v.ticks = [0];
	if (splits.length > 1) {
		v.max = splits[splits.length - 1].best / 60;
	} else {
		v.max = 5000;
	}
	v.segcolors = ["rgba(255,165,0,", "rgba(50,205,50,", "rgba(178,34,34,"];
	v.startfincolors = ["rgba(50,205,50,0.7)"];
	v.startfin = [
		[
			[0, -10000000],
			[0, 10000000]
		]
	];
	if (splits.length > 0 && splits[splits.length - 1].best > 0) {
		v.startfincolors.push("rgba(178,34,34,0.7)");
		v.startfin.push([
			[splits[splits.length - 1].best, -10000000],
			[splits[splits.length - 1].best, 10000000]
		]);
	}
	v.colors = [];
	v.segments = [];
	v.lastpoint = [0, 0];
	if (splits.length == 0) {
		return;
	}
	for (var i in splits) {
		v.ticks.push(splits[i].best);
		if (i < v.n) {
			var y = splits[i].current - splits[i].best;
			var x = splits[i].current;
			v.data.push([x, y]);
		}
	}
	if (!v.plot && options.graph) {
		v.plot = $.plot("#graph", [[0, 0]], plotopt);
	}
	var opac = 1;
	for (var i in v.data) {
		if (i < v.n) {
			v.opac = 1;
			if (splits[i].seg < splits[i].bestseg) {
				v.colors.push(v.segcolors[0] + opac + ")");
			} else if (rnd(v.data[i][1]) > 0) {
				v.colors.push(v.segcolors[2] + opac + ")");
			} else {
				v.colors.push(v.segcolors[1] + opac + ")");
			}
		}
		if (
			Math.abs(v.data[i][1]) > v.max &&
			(i < v.n || (i == v.n && v.data[i][1] > 0))
		) {
			v.max = Math.abs(v.data[i][1]);
		}
		v.segments.push([v.lastpoint, v.data[i]]);
		v.lastpoint = v.data[i];
	}
};

export const draw = function () {
	if (!options.graph) {
		clearInterval(v.drawinter);
		v.drawinter = 0;
		return;
	}
	if (!options.graph || $("#graph").is(":hidden")) {
		setOption.graph(false, v);
	}
	if (v.state == PAUSED || splits.length == 0 || !options.graph) {
		return;
	}
	if (!v.data || v.n > v.data.length) {
		updateStaticSegments();
	}
	var i = v.n;
	if (!splits[i]) {
		return;
	}
	if (!v.plot) {
		v.plot = $.plot("#graph", [[0, 0]], plotopt);
	}
	var y = v.time - splits[i].best;
	var x = v.time;
	v.data[i] = [x, y];
	var opac = 1;
	var color = "rgba(0,0,0,0)";
	if (v.n == 0) {
		opac = v.time / (splits[v.n].bestseg || splits[v.n].best);
		if (!v.inter) {
			opac = 1;
		}
		if (v.time < splits[0].bestseg) {
			color = v.segcolors[0] + opac + ")";
		} else if (rnd(v.data[v.n][1]) > 0) {
			color = v.segcolors[2] + opac + ")";
		} else {
			color = v.segcolors[1] + opac + ")";
		}
	} else {
		opac =
			(v.time - splits[i - 1].current) /
			(splits[i].bestseg || splits[i].best - splits[i - 1].best);
		if (!v.inter) {
			opac = 1;
		}
		if (v.time - splits[i - 1].current < splits[i].bestseg) {
			color = v.segcolors[0] + opac + ")";
		} else if (rnd(v.data[v.n][1]) > 0) {
			color = v.segcolors[2] + opac + ")";
		} else {
			color = v.segcolors[1] + opac + ")";
		}
	}
	if (Math.abs(v.data[i][1]) > v.max && v.data[i][1] > 0) {
		v.max = Math.abs(v.data[i][1]);
	}
	if (v.time > 0) {
		v.colors[i] = color;
		v.segments[i] = [v.lastpoint, v.data[i]];
	}
	v.plot.getOptions().colors = v.startfincolors.concat(v.colors).reverse();
	v.plot.setData(v.startfin.concat(v.segments).reverse());
	v.plot.getOptions().xaxes[0].ticks = v.ticks;
	v.plot.getOptions().yaxes[0].max = v.max;
	v.plot.getOptions().yaxes[0].min = -v.max;
	if (v.time > splits[splits.length - 1].best) {
		v.plot.getOptions().xaxes[0].max = v.time;
	} else {
		v.plot.getOptions().xaxes[0].max = splits[splits.length - 1].best;
	}
	v.plot.getOptions().xaxes[0].min = 0;
	v.plot.setupGrid();
	v.plot.draw();
};

var editOptions = function () {
	if ($("#options").is(":visible")) {
		$("#options .value").each(function () {
			var key = $(this).data("key");
			var val = $(this).html();
			if (val == null) {
				return;
			}
			if (!isNaN(parseFloat(val))) {
				val = parseFloat(val);
			}
			if (val === "true") {
				val = true;
			}
			if (val === "false") {
				val = false;
			}
			if (val !== options[i]) {
				setOption(key, val);
			}
		});
		$("#options").hide();
		$("#splits").show();
		$("#titlerow").show();
		if (options.graph) $("#graph").show();
		if (options.toolbar) $("#bar").show();
		return;
	}
	$("#options").html("");
	$("#options").append(
		'<div class="help">Hover over a setting for help.</div>'
	);
	for (var i in help) {
		$("#options").append(
			'<div class="option"><span class="variable" title="' +
				help[i] +
				" (default: " +
				optionDefaults[i] +
				')">' +
				i +
				':</span><span class="value" contenteditable="true" title="' +
				help[i] +
				" (default: " +
				optionDefaults[i] +
				')" data-key="' +
				i +
				'">' +
				options[i] +
				"</span></div>"
		);
	}
	$("#options").append(
		'<div class="help">Click <i class="fa fa-fw fa-cog"></i> to save.</div>'
	);
	$("#graph").hide();
	$("#titlerow").hide();
	$("#splits").hide();
	$("#options").show();
	/* TODO Port Resizing to previous size.
	if (typeof win !== "undefined") {
		var optheight = parseInt(
			($("#timer").height() +
				$("#bar").height() +
				$("#options")[0].scrollHeight) *
				Math.pow(1.2, win.zoomLevel)
		);
		if (win.height < optheight) {
			//win.height = optheight
		}
		if (win.width < 200) {
			win.width = 200;
		}
	}
	*/
};

var _save = function () {
	localStorage.splits = JSON.stringify(splits);
	setOption("css", $("style").html());
	/* TODO: Do I need to port these settings?
	if (typeof win !== "undefined") {
    options.width = win.width;
    options.height = win.height;
    options.x "= win.x;
    options.y = win.y;
  }
	*/
	localStorage.options = JSON.stringify(options);
	var savev = {};
	var savedvars = [
		"n",
		"time",
		"state",
		"pausestart",
		"start",
		"stop",
		"history"
	];
	for (var i in savedvars) {
		savev[savedvars[i]] = v[savedvars[i]];
	}
	localStorage.v = JSON.stringify(savev);
};

var undo = function () {
	if (v.state == STOPPED) {
		v.inter = setInterval(updateTime, options.interval);
		v.drawinter = setInterval(draw, options.drawinterval);
		v.state = RUNNING;
	} else if ((v.state == RUNNING || v.state == PAUSED) && v.n > 0) {
		$(".split:nth(" + v.n + ") .diff")
			.html("")
			.removeClass("better worse");
		v.n--;
	} else if (v.state == RESET) {
		if (splits.length > 0) {
			exportWsplit();
		} else {
			importWsplit();
		}
	}
};

var split = function () {
	if (v.state == PAUSED) {
		pause();
		return;
	} else if (v.state == RESET) {
		v.start = new Date().getTime() - (parseInt(options.offset) || 0);
		v.n = 0;
		setOption("attempts", options.attempts + 1);
		v.inter = setInterval(updateTime, options.interval);
		v.drawinter = setInterval(draw, options.drawinterval);
		v.state = RUNNING;
	} else if (v.state == RUNNING) {
		if (!options.autoadd && v.n >= splits.length - 1) {
			addSplit();
			stop();
			return;
		}
		addSplit();
	} else if (v.state == STOPPED) {
		reset();
	}
	updateStaticSegments();
	centerSplit();
	_save();
};

var splitHandler = function (c) {
	for (var i in c) {
		for (var s in splits) {
			if (splits[s] == c[i].object) {
				$(".split:nth(" + s + ") .name").html(splits[s].name);
				$(".split:nth(" + s + ") .time").html(ttime(splits[s].best));
				$(".split:nth(" + s + ") .seg").html(ttime(splits[s].bestseg));
			}
		}
	}
};

var addSplit = function (add) {
	if (add) {
		var name = "Split " + (splits.length + 1);
		splits.push({
			name: name,
			current: 0,
			best: 0,
			seg: 0,
			bestseg: 0,
			icon: ""
		});
		Object.observe(splits[splits.length - 1], splitHandler);
		appendSplit(name, 0, 0);
		return;
	}
	var split =
		v.state == STOPPED ? v.stop - v.start : new Date().getTime() - v.start;
	if (v.start == 0) {
		split = 0;
	}
	var seg = split;
	if (splits[v.n - 1]) {
		seg = split - splits[v.n - 1].current;
	}
	var name = "Split " + (1 + v.n);
	if (
		splits.length == 0 ||
		(splits.length <= v.n && options.autoadd && v.inter)
	) {
		splits.push({
			name: name,
			current: split,
			best: 0,
			seg: seg,
			bestseg: 0,
			icon: ""
		});
		Object.observe(splits[splits.length - 1], splitHandler);
		appendSplit(name, split, seg);
	} else if (splits[v.n]) {
		splits[v.n].current = split;
		splits[v.n].seg = seg;
	}
	if ((options.autoadd || v.n < splits.length - 1) && v.state == RUNNING) {
		v.n++;
	}
	if (v.inter) {
		draw();
	}
	updateStaticSegments();
};

var saveSplits = function (all) {
	var old = clone(splits);
	var changes = false;
	for (var i in splits) {
		if (
			/*i<v.n || */ (v.n == splits.length - 1 &&
				splits[i].current > 0 &&
				splits[i].current < splits[i].best &&
				v.time <= splits[splits.length - 1].best) ||
			splits[i].best == 0 ||
			all
		) {
			splits[i].best = splits[i].current;
			$(".time:nth(" + i + ")").html(ttime(splits[i].best));
			changes = true;
		}
		if (
			((i < v.n || v.n == splits.length - 1) &&
				splits[i].seg > 0 &&
				splits[i].seg < splits[i].bestseg) ||
			splits[i].bestseg == 0 ||
			all
		) {
			splits[i].bestseg = splits[i].seg;
			$(".seg:nth(" + i + ")").html(ttime(splits[i].bestseg));
			changes = true;
		}
	}
	if (changes) {
		v.history.push(old);
		if (v.history.length > options.history) {
			v.history.shift();
		}
	}
	updateStaticSegments();
};

var stop = function () {
	if (v.state == RESET) {
		addSplit(splits.length);
	} else if (v.state == RUNNING) {
		v.state = STOPPED;
		v.stop = new Date().getTime();
		updateTime();
		clearInterval(v.inter);
		clearInterval(v.drawinter);
		v.inter = 0;
		addSplit();
	} else if (v.state == PAUSED) {
		v.state = STOPPED;
		v.stop = v.pausestart;
		updateTime();
		clearInterval(v.inter);
		clearInterval(v.drawinter);
		v.inter = 0;
		addSplit();
	} else if (v.state == STOPPED) {
		saveSplits(v.stops > 5 && v.n >= splits.length - 1);
	}
	if (v.stops == 0) {
		setTimeout(function () {
			v.stops = 0;
		}, 700);
	}
	v.stops++;
	if (v.state != RESET) {
		v.state = STOPPED;
	}
	_save();
	centerSplit();
};

var trash = function () {
	reset();
	v.resets = 10;
	reset();
	updateStaticSegments();
};

var reset = function () {
	if (v.time == 0 && v.state == RESET && v.resets > 5) {
		splits = [];
		$("#splits").html("");
		for (var i = 0; i < options.splits; i++) {
			addSplit(true);
		}
		$("#title").html(options.title);
		$("#attempts").html(options.attempts);
		_save();
	}
	if (splits.length == 0) {
		$("#buttonsave").hide();
		$("#buttonload").show();
	} else {
		$("#buttonload").hide();
		$("#buttonsave").show();
	}
	if (v.resets == 0) {
		setTimeout(function () {
			v.resets = 0;
		}, 700);
	}
	if (options.autosave) {
		saveSplits();
	}
	v.resets++;
	clearInterval(v.inter);
	clearInterval(v.drawinter);
	v.start = 0;
	v.inter = 0;
	v.n = 0;
	v.time = 0;
	v.state = RESET;
	centerSplit();
	updateStaticSegments();
	draw();
	_save();
};

var pause = function () {
	if (v.state == PAUSED) {
		var pausetime = new Date().getTime() - v.pausestart;
		v.start += pausetime;
		v.state = RUNNING;
		v.inter = setInterval(updateTime, options.interval);
		v.drawinter = setInterval(draw, options.drawinterval);
	} else if (v.state == RUNNING) {
		v.pausestart = new Date().getTime();
		v.state = PAUSED;
		clearInterval(v.inter);
		clearInterval(v.drawinter);
		v.inter = 0;
		v.drawinter = 0;
	} else {
		editOptions();
	}
	updateTime();
	_save();
};

var centerSplit = function () {
	resizeSplits();
	var el = $(".split[data-id=" + v.n + "]");
	if (el.length == 0) {
		el = $(".split[data-id=" + (v.n - 1) + "]");
		if (el.length == 0) {
			return;
		}
	}
	var from = {
		top: $("#splits").scrollTop(),
		left: $("#splits").scrollLeft()
	};
	$("#splits").scrollTop(0);
	$("#splits").scrollLeft(0);
	var to = {
		top:
			el.position().top -
			$("#splits").position().top -
			$("#splits").height() / 2 +
			el.height() / 2,
		left:
			el.position().left -
			$("#splits").position().left -
			$("#splits").width() / 2 +
			el.width() / 2
	};
	$("#splits").scrollTop(from.top);
	$("#splits").scrollLeft(from.left);
	$("#splits")
		.stop(true, true)
		.animate(
			{ scrollTop: to.top, scrollLeft: to.left },
			{ duration: 200, queue: false }
		);
};

var resizeSplits = function () {
	$("#container").height($(window).height());
	$("#container").width($(window).width());
	if (v.plot) {
		v.plot.resize();
		draw();
	}
};

var updateTime = function () {
	if (v.state == RUNNING) {
		v.time = new Date().getTime() - v.start;
	} else if (v.state == STOPPED) {
		v.time = v.stop - v.start;
	} else if (v.state == RESET) {
		v.time = parseInt(options.offset) || 0;
	} else if (v.state == PAUSED) {
		v.time = v.pausestart - v.start;
	}
};

var drawTime = function () {
	v.timer.html((v.time < 0 ? "-" : "") + ttime(v.time));
	if (v.time > 0 && splits[v.n]) {
		v.diff.html(ttime(v.time - splits[v.n].best));
		if (rnd(v.time) > rnd(splits[v.n].best)) {
			v.diff.removeClass("better").addClass("worse");
		} else {
			v.diff.removeClass("worse").addClass("better");
		}
		var seg = v.time;
		if (v.n > 0) {
			seg = v.time - splits[v.n - 1].current;
		}
		if (rnd(seg) < rnd(splits[v.n].bestseg)) {
			v.diff.addClass("gold");
		} else {
			v.diff.removeClass("gold");
		}
	}
};

var appendSplit = function (myname, mytime, myseg) {
	var id = $(".split").length;
	$("#splits").append(
		'<div class="split" data-id="' +
			id +
			'"><img class="icon" src="' +
			(splits[id].icon || options.icon || "//:0") +
			'"><span class="name" contenteditable="true">' +
			myname +
			'</span><span class="diff"></span><span class="seg" contenteditable="true">' +
			ttime(myseg) +
			'</span><span class="time" contenteditable="true">' +
			ttime(mytime) +
			"</span></div>"
	);
	$("#buttonload").hide();
	$("#buttonsave").show();
	v.diff = $(".diff:nth(" + v.n + ")");
	optionHandler["iconsize"]();
};

var importExport = function () {
	if (splits.length > 0) {
		exportWsplit();
	} else {
		importWsplit();
	}
};

var exportWsplit = function () {
	var data =
		"Title=" +
		options.title +
		"\r\nAttempts=" +
		options.attempts +
		"\r\nOffset=0\r\nSize=200,25\r\n";
	var icons = [];
	for (var i in splits) {
		data +=
			splits[i].name +
			",0," +
			rnd(splits[i].best / 1000) +
			"," +
			rnd(splits[i].bestseg / 1000) +
			"\r\n";
		icons.push('"' + splits[i].icon + '"');
	}
	data += "Icons=" + icons.join(",");
	if (window.__TAURI__) {
		save({
			filters: [{ name: "Split Files", extensions: ["wsplit"] }]
		}).then(async path => {
			await writeTextFile({ path: path, contents: data });
		});
	} else {
		var ex = document.createElement("a");
		ex.setAttribute(
			"href",
			"data:text/plain;charset=utf-8," + encodeURIComponent(data)
		);
		ex.setAttribute("download", options.title + ".wsplit");
		ex.click();
	}
};

var importWsplit = function () {
	var file = $('<input type="file" accept=".wsplit">');
	file.change(function () {
		var reader = new FileReader();
		reader.onloadend = function () {
			var metareg = false;
			var reg = false;
			var iconreg = /"([^"]*)"/gm;
			if (file[0].files[0].name.match(/\.wsplit$/)) {
				metareg = /Title=(.*)$[^]*?Attempts=(.*?)$[^]*?Icons=(.*?)$/gm;
				reg = /^(.*),[\d\.]*,([\d\.]*),([\d\.]*)$/gm;
			} else {
				return;
			}
			var meta = metareg.exec(reader.result);
			setOptions("title", meta[1]);
			$("#title").html(options.title);
			setOption("attempts", parseInt(meta[2]) || 0);
			$("#attempts").html(options.attempts);
			splits = [];
			$("#splits").html("");
			let found;
			while ((found = reg.exec(reader.result))) {
				var newtime = 1000 * found[2];
				var newseg = 1000 * found[3];
				var newname = String(found[1]);
				var newicon = iconreg.exec(meta[3])[1] || "";
				splits.push({
					name: newname,
					current: 1 * newtime,
					best: 1 * newtime,
					seg: 1 * newseg,
					bestseg: 1 * newseg,
					icon: newicon
				});
				Object.observe(splits[splits.length - 1], splitHandler);
				appendSplit(newname, newtime, newseg);
			}
			_save();
		};
		reader.readAsText(this.files[0]);
	});
	file.click();
};

// NOTE: This only affects individual splits, and not `options.icon`.
const loadIcon = splitNumber => {
	const file = $('<input type="file" accept="image/*">');
	file.change(function () {
		var reader = new FileReader();
		if (file[0].files[0].path) {
			splits[splitNumber].icon = file[0].files[0].path;
			$(".icon")[splitNumber].src = file[0].files[0].path;
		} else {
			reader.onloadend = function () {
				splits[splitNumber].icon = reader.result;
				$(".icon")[splitNumber].src = reader.result;
				_save();
			};
			reader.readAsDataURL(file[0].files[0]);
		}
	});
	file.click();
};

let storedv = JSON.parse(localStorage.v || "[]");
for (var i in storedv) {
	v[i] = clone(storedv[i]);
}

let variableHandler = {
	state: function () {
		if (v.state == PAUSED) {
			$(".split:nth(" + v.n + ")").addClass("current");
			v.timer.removeClass().addClass("paused");
			v.timer.html((options.offset < 0 ? "-" : "") + ttime(v.time));
		} else if (v.state == RUNNING) {
			if (!v.inter) {
				v.inter = setInterval(updateTime, options.interval);
			}
			if (!v.drawinter && options.graph) {
				v.drawinter = setInterval(draw, options.drawinterval);
			}
			$(".split:nth(" + v.n + ")").addClass("current");
			v.timer.removeClass().addClass("running");
			$("#buttonreset, #buttonstop, #buttonpause, #buttonundo").show();
			$(
				"#buttonclear, #buttonadd, #buttonoptions, #buttontimes, #buttonsave, #buttonload"
			).hide();
		} else if (v.state == STOPPED) {
			$(".split:nth(" + v.n + ")").addClass("current");
			v.timer.removeClass().addClass("stopped");
			v.timer.html((options.offset < 0 ? "-" : "") + ttime(v.time));
			$(
				"#buttonadd, #buttonstop, #buttonpause, #buttonsave, #buttonload"
			).hide();
			$("#buttontimes, #buttonoptions").show();
		} else if (v.state == RESET) {
			v.timer.removeClass();
			v.timer.html(
				(options.offset < 0 ? "-" : "") + ttime(options.offset)
			);
			v.timer.removeClass();
			$(".diff").removeClass("better worse gold");
			$(".diff").html("");
			$(".split").removeClass("current");
			$(
				"#buttonreset, #buttonstop, #buttonpause, #buttontimes, #buttonpause, #buttonundo"
			).hide();
			$("#buttonclear, #buttonadd, #buttonoptions").show();
			if (splits.length > 0) {
				$("#buttonsave").show();
			} else {
				$("#buttonload").show();
			}
		}
	},
	n: function () {
		$(".split").removeClass("current");
		$(".split:nth(" + v.n + ")").addClass("current");
		v.diff = $(".diff:nth(" + v.n + ")");
		updateStaticSegments();
	},
	time: function () {
		if (v.time > 0 && splits[v.n]) {
			if (v.time < splits[v.n].best) {
				v.timer.removeClass("worse").addClass("better");
			} else if (v.time > splits[v.n].best) {
				v.timer.removeClass("better").addClass("worse");
			} else {
				v.timer.removeClass("better worse");
			}
		}
		if (v.state == RUNNING) drawTime();
	}
};

export let splits = localStorage.splits ? JSON.parse(localStorage.splits) : [];
if (splits.length == 0 && options.splits > 0) {
	for (var i = 0; i < options.splits; i++) {
		addSplit(true);
	}
}
for (var i in splits) {
	Object.observe(splits[i], splitHandler);
}

if (window.__TAURI__) {
	/* TODO: Figure out what of this I need to port
	win.setAlwaysOnTop(options.ontop)
  if(!isNaN(Math.log(options.zoom)/Math.log(1.2))) {
    win.zoomLevel = Math.log(options.zoom)/Math.log(1.2)
  }
  if(options.x) {
    win.x = options.x
  }
  if(options.y) {
    win.y = options.y
  }
  if(options.width) {
    win.width = options.width
  }
  if(options.height) {
    win.height = options.height
  }
  v.shortcut_split = new gui.Shortcut({key: options.global_split,active: function(){split()},failed: function(msg){console.log(msg)}})
  gui.App.registerGlobalHotKey(v.shortcut_split)
  v.shortcut_stop = new gui.Shortcut({key: options.global_stop,active: function(){stop()},failed: function(msg){console.log(msg)}})
  gui.App.registerGlobalHotKey(v.shortcut_stop)
  v.shortcut_pause = new gui.Shortcut({key: options.global_pause,active: function(){pause()},failed: function(msg){console.log(msg)}})
  gui.App.registerGlobalHotKey(v.shortcut_pause)
  v.shortcut_reset = new gui.Shortcut({key: options.global_reset,active: function(){reset()},failed: function(msg){console.log(msg)}})
  gui.App.registerGlobalHotKey(v.shortcut_reset)
  v.shortcut_undo = new gui.Shortcut({key: options.global_undo,active: function(){undo()},failed: function(msg){console.log(msg)}})
  gui.App.registerGlobalHotKey(v.shortcut_undo)
  var menu = new gui.Menu()
  menu.append(new gui.MenuItem({ label: 'Import splits' }))
  menu.append(new gui.MenuItem({ label: 'Export splits' }))
  menu.append(new gui.MenuItem({ type: 'separator' }))
  menu.append(new gui.MenuItem({ label: 'Start / Split' }))
  menu.append(new gui.MenuItem({ label: 'Stop / Save times' }))
  menu.append(new gui.MenuItem({ label: 'Pause / Unpause' }))
  menu.append(new gui.MenuItem({ label: 'Reset' }))
  menu.append(new gui.MenuItem({ label: 'Clear all' }))
  menu.append(new gui.MenuItem({ label: 'Undo split' }))
  menu.append(new gui.MenuItem({ label: 'Add split' }))
  menu.append(new gui.MenuItem({ type: 'separator' }))
  menu.append(new gui.MenuItem({ label: 'Settings' }))
  menu.append(new gui.MenuItem({ label: 'Add custom theme' }))
  menu.append(new gui.MenuItem({ label: 'Clear custom theme' }))
  menu.append(new gui.MenuItem({ label: 'Load defaults' }))
  menu.append(new gui.MenuItem({ label: 'Show graph' }))
  menu.append(new gui.MenuItem({ label: 'Show toolbar' }))
  menu.append(new gui.MenuItem({ label: 'Open devtools' }))
  menu.append(new gui.MenuItem({ type: 'separator' }))
  menu.append(new gui.MenuItem({ label: 'Exit' }))
  menu.items[0].click = function() { importWsplit() }
  menu.items[1].click = function() { exportWsplit() }
  menu.items[3].click = function() { split() }
  menu.items[4].click = function() { stop() }
  menu.items[5].click = function() { pause() }
  menu.items[6].click = function() { reset() }
  menu.items[7].click = function() { trash() }
  menu.items[8].click = function() { undo() }
  menu.items[9].click = function() { addSplit(true) }
  menu.items[11].click = function() { editOptions() }
  menu.items[12].click = function() { loadCss() }
  menu.items[13].click = function() { $('style').html(''); save() }
  menu.items[14].click = function() { localStorage.clear; for(var i in optionDefaults) {options[i] = clone(optiooptionDDefaults[i])} }
  menu.items[15].click = function() { options.graph = !options.graph }
  menu.items[16].click = function() { options.toolbar = !options.toolbar }
  menu.items[17].click = function() { win.showDevTools() }
  menu.items[19].click = function() { win.close() }
  window.oncontextmenu = function(e) {
    if(e.button == 2) {
      menu.popup(e.clientX, e.clientY)
    }
  }

*/

	let sock_path = false;
	let osType = await type();
	console.log(osType);
	if (osType.match(/Linux|Darwin/gi)) {
		let dir = await tempdir();
		sock_path = dir + "/nwsplit.sock";
	} else if (osType.match(/Windows_NT/gi)) {
		sock_path = "\\\\.\\pipe\\nwsplit";
	}
	console.log(sock_path);
	if (sock_path) {
		listen("pipe_event", event => {
			console.log("Recieved Event:");
			console.log(event);
			eval(event.payload.message);
		});
		invoke("mkpipe", { location: sock_path.toString() });
		console.log(65);
	}
	/*
  win.on('close', function() {
    this.hide()
    if(server) {
      server.close()
    }
    save()
    this.close(true)
  })
	*/
}

var buttonHandler = {
	buttonsave: function () {
		exportWsplit();
	},
	buttonload: function () {
		importWsplit();
	},
	buttonreset: function () {
		reset();
	},
	buttonclear: function () {
		trash();
	},
	buttonpause: function () {
		pause();
	},
	buttonoptions: function () {
		editOptions();
	},
	buttonadd: function () {
		stop();
	},
	buttonstop: function () {
		stop();
	},
	buttontimes: function () {
		stop();
	},
	buttonsplit: function () {
		split();
	},
	buttonundo: function () {
		undo();
	}
};

var gotoEnd = function (el) {
	var range, selection;
	if (document.createRange) {
		range = document.createRange();
		range.selectNodeContents(el);
		range.collapse(false);
		selection = window.getSelection();
		selection.removeAllRanges();
		selection.addRange(range);
	} else if (document.selection) {
		range = document.body.createTextRange();
		range.moveToElementText(el);
		range.collapse(false);
		range.select();
	}
};

$(function () {
	v.timer = $("#timer");
	v.title = $("#title");
	v.attempts = $("#attempts");
	if (!options.graph) {
		$("#graph").hide();
	}
	if (!options.toolbar && typeof win !== "undefined") {
		$("#bar").hide();
	}
	v.title.html(options.title);
	v.attempts.html(options.attempts);
	$("style").html(options.css);
	resizeSplits();
	$(window).resize(function (e) {
		centerSplit();
	});
	$(window).keydown(function (e) {
		if ($(e.target).attr("contenteditable") == "true") {
			if (e.which == 13) {
				e.preventDefault();
				$("#splits").click();
			} else if (e.which == 40) {
				e.preventDefault();
				var el = $(
					".split:nth(" +
						((1 * $(e.target).parent().attr("data-id") + 1) %
							splits.length) +
						") ." +
						e.target.classList[0]
				);
				if (el) {
					el.focus();
					gotoEnd(el[0]);
				}
			} else if (e.which == 38) {
				e.preventDefault();
				var el = $(
					".split:nth(" +
						(1 * $(e.target).parent().attr("data-id") - 1) +
						") ." +
						e.target.classList[0]
				);
				if (el) {
					el.focus();
					gotoEnd(el[0]);
				}
			}
			return;
		}
		if (e.which == key(options.local_split)) {
			e.preventDefault();
			split();
		} else if (e.which == key(options.local_stop)) {
			e.preventDefault();
			stop();
		} else if (e.which == key(options.local_reset)) {
			e.preventDefault();
			reset();
		} else if (e.which == key(options.local_pause)) {
			e.preventDefault();
			pause();
		} else if (e.which == key(options.local_undo)) {
			e.preventDefault();
			undo();
		}
	});
	$("#timer").html(options.offset < 0 ? "-" : "") + ttime(options.offset);
	for (var i in splits) {
		appendSplit(splits[i].name, splits[i].best, splits[i].bestseg);
	}
	$("#container").on(
		"click, focus",
		'[contenteditable="true"]',
		function (e) {
			e.preventDefault();
			e.stopPropagation();
			gotoEnd(e.target);
		}
	);
	$("#splits").on("click", ".icon", function () {
		loadIcon($(this).parents(".split").attr("data-id"));
	});
	$("#splits").on("click", function (e) {
		if ($(e.target).attr("contenteditable") != "true") {
			$("[contenteditable]").blur();
		}
	});
	$("#container").on("blur", ".time", function (e) {
		if (!e.isSimulated) {
			return false;
		}
		var id = $(this).parents(".split").attr("data-id");
		if (!splits[id]) {
			return;
		}
		var val = getMs($(this).text());
		splits[id].best = val;
		splits[id].current = val;
		$(this).html(ttime(val));
		_save();
		$("#splits").click();
	});
	$("#container").on("blur", ".seg", function (e) {
		if (!e.isSimulated) {
			return false;
		}
		var id = $(this).parents(".split").attr("data-id");
		if (!splits[id]) {
			return;
		}
		var val = getMs($(this).text());
		splits[id].bestseg = val;
		splits[id].seg = val;
		$(this).html(ttime(val));
		_save();
		$("#splits").click();
	});
	$("#container").on("blur", ".name", function (e) {
		var id = $(this).parents(".split").attr("data-id");
		if (!splits[id]) {
			return;
		}
		var val = $(this).html();
		if (val == "") {
			splits.splice(id, 1);
			$(this).parents(".split").remove();
			var m = 0;
			$(".split").each(function () {
				$(this).attr("data-id", m);
				m++;
			});
			if (v.n > id) {
				v.n--;
			}
		} else {
			splits[id].name = val;
		}
		_save();
		$("#timer").click();
	});

	/* TODO PORT
  if (typeof win !== "undefined") {
    $(window).bind("mousewheel", function (e) {
      if (!e.ctrlKey) {
        return;
      }
      if (e.originalEvent.wheelDelta / 120 > 0) {
        e.preventDefault();
        options.zoom += 0.1;
      } else {
        e.preventDefault();
        options.zoom -= 0.1;
      }
    });
  }
	*/
	// TODO check if these Jquerys for $(window) are nwsplit dependent
	$(window).scroll(function () {
		$(window).scrollTop(0);
		$(window).scrollLeft(0);
	});
	$("#title").blur(function () {
		options.title = $("#title").html();
		_save();
	});
	$("#attempts").blur(function () {
		options.attempts = parseInt($("#attempts").html()) || 0;
		_save();
	});
	$("#bar").on("click", ".button", function (e) {
		if (buttonHandler[this.id]) {
			buttonHandler[this.id]();
		}
	});
	window.ondragover = function (e) {
		e.preventDefault();
		return false;
	};
	window.ondrop = function (e) {
		if (e.target.id != "file") {
			e.preventDefault();
			return false;
		}
	};
	variableHandler["state"]();
	Object.observe(v, function (c) {
		for (var i in c) {
			if (variableHandler[c[i].name]) {
				variableHandler[c[i].name]();
			}
		}
	});
	Object.observe(options, function (c) {
		for (var i in c) {
			if (optionHandler[c[i].name]) {
				optionHandler[c[i].name](options[c[i].name]);
			}
		}
		_save();
	});
	custom = $("#custom");
});
