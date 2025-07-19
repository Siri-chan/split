export const clone = (obj) => {
  if (null == obj || "object" != typeof obj) return obj;
  if (obj instanceof Date) {
    var copy = new Date();
    copy.setTime(obj.getTime());
    return copy;
  }
  if (obj instanceof Array) {
    var copy = [];
    for (var i = 0, len = obj.length; i < len; i++) {
      copy[i] = clone(obj[i]);
    }
    return copy;
  }
  if (obj instanceof Object) {
    var copy = {};
    for (var attr in obj) {
      if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
    }
    return copy;
  }
}

export const parseBool = (bool) => {
  return !(bool == "false" || bool == 0 || bool == "0")
};

export const getMs = (time) => {
  time = time.replace(",", ".");
  if (!time.match(/:/)) {
    return 1000 * (parseFloat(time) || 0);
  }
  time = time.replace(/[^\d.:]*/gm, "");
  var ms = 0;
  time = time.split(":");
  time.reverse();
  var multi = [1000, 60 * 1000, 60 * 60 * 1000];
  for (var i = time.length - 1; i >= 0; i--) {
    ms += multi[i] * time[i];
  }
  return ms;
};

export const keymap = {
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
  "'": 222,
};

export const key = (name) => {
  return (
    keymap[String(name).toLowerCase()] ||
    String(name).toUpperCase().charCodeAt(0)
  );
};

export const rnd = (num) => {
  return parseFloat(num.toFixed(3));
};
