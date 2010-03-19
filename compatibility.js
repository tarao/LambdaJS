if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function(elt, from) {
        var len = this.length;
        if (typeof from == 'undefined') from = 0;
        from = Number(from);
        from = (from < 0) ? Math.ceil(from) : Math.floor(from);
        if (from < 0) from += len;
        for (; from < len; from++) {
            if (from in this && this[from] === elt) return from;
        }
        return -1;
    };
}
if (!Array.prototype.filter) {
    Array.prototype.filter = function(fun, thisp) {
        var len = this.length;
        if (typeof fun != "function") {
            throw new TypeError('filter: not a function');
        }
        var rv = new Array();
        for (var i = 0; i < len; i++) {
            if (i in this) {
                var val = this[i]; // in case fun mutates this
                if (fun.call(thisp, val, i, this)) rv.push(val);
            }
        }
        return rv;
    };
}
if (!Array.prototype.forEach) {
    Array.prototype.forEach = function(fun, thisp) {
        var len = this.length;
        if (typeof fun != 'function') {
            throw new TypeError('forEach: not a function');
        }
        for (var i=0; i < len; i++) {
            if (i in this) fun.call(thisp, this[i], i, this);
        }
    };
}
if (!Array.prototype.every) {
    Array.prototype.every = function(fun, thisp) {
        var len = this.length;
        if (typeof fun != 'function') {
            throw new TypeError('every: not a function');
        }
        for (var i = 0; i < len; i++) {
            if (i in this && !fun.call(thisp, this[i], i, this)) {
                return false;
            }
        }
        return true;
    };
}
if (!Array.prototype.map) {
    Array.prototype.map = function(fun, thisp) {
        var len = this.length;
        if (typeof fun != 'function') {
            throw new TypeError('map: not a function');
        }
        var rv = new Array(len);
        for (var i = 0; i < len; i++) {
            if (i in this) rv[i] = fun.call(thisp, this[i], i, this);
        }
        return rv;
    };
}
if (!Array.prototype.some) {
    Array.prototype.some = function(fun, thisp) {
        var len = this.length;
        if (typeof fun != "function") {
            throw new TypeError('some: not a function');
        }
        for (var i = 0; i < len; i++) {
            if (i in this && fun.call(thisp, this[i], i, this)) return true;
        }
        return false;
    };
}
if (!Array.prototype.reduce) {
    Array.prototype.reduce = function(fun, initial) {
        var len = this.length;
        if (typeof fun != 'function') {
            throw TypeError('reduce: not a function ');
        }
        var i = 0;
        var prev;
        var rv;
        if (typeof initial != 'undefined') {
            rv = initial;
        } else {
            do {
                if (i in this) {
                    rv = this[i++];
                    break;
                }
                if (++i >= len) throw new TypeError('reduce: empty array');
            } while (true);
        }
        for (; i < len; i++) {
            if (i in this) rv = fun.call(null, rv, this[i], i, this);
        }
        return rv;
    };
}
if (!Array.prototype.reduceRight) {
    Array.prototype.reduceRight = function(fun, initial) {
        var len = this.length;
        if (typeof fun != "function") {
            throw new TypeError('reduceRight: not a function');
        }
        var i = len - 1;
        var rv;
        if (typeof initial != 'undefined') {
            rv = initial;
        } else {
            do {
                if (i in this) {
                    rv = this[i--];
                    break;
                }
                if (--i < 0)  throw new TypeError('reduceRight: empty array');
            } while (true);
        }
        for (; i >= 0; i--) {
            if (i in this) rv = fun.call(null, rv, this[i], i, this);
        }
        return rv;
    };
}
