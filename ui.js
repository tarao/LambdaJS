if (typeof UI == 'undefined') var UI = {};

(function(ns) {
    var forEach = function(hash, f){ for (var p in hash) f(p, hash[p]); };
    var merge = function() {
        var hash = {}; var args=[]; args.push.apply(args, arguments);
        args.forEach(function(arg) { forEach(arg, function(k,x) {
            if (typeof hash[k] == 'undefined') hash[k] = x;
        }); });
        return hash;
    }
    ns.doc = ns.doc || document;
    ns.isNode = function(x){ return x && typeof x.nodeType == 'number'; };
    ns.text = function(node){ return node.textContent||node.innerText||''; };
    ns._$ = function(id){ return ns.doc.getElementById(id); };
    ns.$ = function(id){ return ns.isNode(id) ? id : ns._$(id); };
    ns.$new = function(tag, args) {
        var elm = ns.doc.createElement(tag);
        args = args || {};
        if (args.id) elm.id = args.id;
        if (args.klass) elm.className = args.klass;
        forEach(args.style||{}, function(k,s){ elm.style[k] = s });
        if (args.child) {
            if (!(args.child instanceof Array)) args.child = [ args.child ];
            for (var i=0; i < args.child.length; i++) {
                var child = ns.$node(args.child[i]);
                elm.appendChild(child);
            }
        }
        return elm;
    };
    ns.$text = function(str){ return ns.doc.createTextNode(str); };
    ns.$node = function(x){ return ns.isNode(x) ? x : ns.$text(x); };
    ns.removeAllChildren = function(node) {
        while (node.firstChild) node.removeChild(node.firstChild);
    };
    ns.replaceLastChild = function(node, child) {
        var last = node.lastChild;
        if (last) node.removeChild(last);
        node.appendChild(child);
    };
    ns.insertText = function(node, text) {
        var start = node.selectionStart;
        var end = node.selectionEnd;
        if (typeof start == 'number' && typeof end == 'number') {
            var before = node.value.substring(0, start);
            var after = node.value.substring(end);
            node.value = before + text + after;
            node.selectionStart = node.selectionEnd = start+text.length;
        } else {
            node.value += text;
        }
    };
    ns.getStyle = function(node, name) {
        var style = (node.style||{})[name];
        if (!style) {
            var dv = ns.doc.defaultView || {};
            if (dv.getComputedStyle) { try {
                var styles = dv.getComputedStyle(node, null);
                name = name.replace(/([A-Z])/g, '-$1').toLowerCase();
                style = styles ? styles.getPropertyValue(name) : null;
            } catch(e) {
                return null;
            } } else if (node.currentStyle) {
                style = node.currentStyle[name];
            }
        }
        return style;
    };
    ns.getPosition = function(node) {
        var pos = { x:0, y:0 };
        do {
            pos.x += node.offsetLeft;
            pos.y += node.offsetTop;
        } while (node = node.offsetParent);
        return pos;
    };
    ns.getMousePosition = function(pos) {
        if (navigator.userAgent.indexOf('Chrome/') != -1 &&
            navigator.userAgent.indexOf('Safari') > -1 &&
            navigator.userAgent.indexOf('Version/' < 0)) {
            return { x: pos.clientX, y: pos.clientY };
        } else {
            var scroll = {}; var de = ns.doc.documentElement;
            if (window.innerWidth) {
                scroll.x = window.pageXOffset;
                scroll.y = window.pageYOffset;
            } else if (de && de.clientWidth) {
                scroll.x = de.scrollLeft;
                scroll.y = de.scrollTop;
            } else if (ns.doc.body.clientWidth) {
                scroll.x = ns.doc.body.scrollLeft;
                scroll.y = ns.doc.body.scrollTop;
            }
            return { x: pos.clientX + scroll.x, y: pos.clientY + scroll.y };
        }
    };
    with (ns) {
        ns.Event = function(e) {
            var self = { event: e };
            self.mousePos = function(){ return getMousePosition(self.event); };
            self.stop = function() {
                if (self.event.stopPropagation) {
                    self.event.stopPropagation();
                    self.event.preventDefault();
                } else {
                    self.event.cancelBubble = true;
                    self.event.returnValue = false;
                }
            };
            return self;
        };
        ns.Observer = function(node, event, fun) {
            var self = { node: node, event: event };
            self.fun = function(e){ return  fun(new Event(e)); };
            self.start = function() {
                if (self.node.addEventListener) {
                    if (event.indexOf('on') == 0) self.event = event.substr(2);
                    self.node.addEventListener(self.event, self.fun, false);
                } else if (self.node.attachEvent) {
                    self.node.attachEvent(self.event, self.fun);
                }
            };
            self.stop = function() {
                if (self.node.removeEventListener) {
                    self.node.removeEventListener(self.event, self.fun, false);
                } else if (self.node.detachEvent) {
                    self.node.detachEvent(self.event, self.fun);
                }
            }
            self.start();
            return self;
        };
        ns.Selector = function(name, keys, action, dflt) {
            var self = { hash: {} };
            forEach(keys, function(k,v){ self.hash[v.name] = { key: k }; });
            self.ul = $(name) || $new('ul', { id: name });
            forEach(self.hash, function(label,x) {
                var key = x.key;
                var selected = (key==dflt || label==dflt);
                var a = $new('a', { child: label });
                var li = $new('li', {
                    id: name+key, klass: selected ? 'selected' : '', child: a
                });
                self.ul.appendChild(x.li = li);
                if (selected) action(key);
                new Observer(a, 'onclick', (function(li) {
                    return function(e) {
                        forEach(self.hash, function(label,x) {
                            if (label == text(li)) {
                                li.className = 'selected';
                                action(x.key);
                            } else {
                                x.li.className = '';
                            }
                        });
                        e.stop();
                    };
                })(li));
            });
            return self;
        };
        ns.AbortButton = function(parent, style, callback) {
            var self = function(){ return self.aborted; };
            self.aborted = false;
            self.doAbort = function(){ self.aborted=true; callback(); };
            self.button = $new('a', { klass: 'abort', style: style, child: [
                $new('span', { klass: 'icon', child: '\u2716' }), 'abort'
            ] });
            parent.appendChild(self.button);
            new Observer(self.button, 'onclick', self.doAbort);
            self.die = function() {
                if (!self.died) parent.removeChild(self.button);
                self.died = true;
            };
            return self;
        };
        ns.Draggable = function(node, opt) {
            opt = opt || {};
            node = $(node);
            if (!getStyle(node, 'position')) node.style.position = 'absolute';
            var self = { node: node, attach: $(opt.attach || node) || node };
            var nop = function(){ return true; };
            self.callback = merge(opt.callback, {start:nop,move:nop,end:nop});
            self.pos = {};
            var pinf = Number.POSITIVE_INFINITY;
            var ninf = Number.NEGATIVE_INFINITY;
            self.lower = merge(opt.lower, { x: ninf, y: ninf });
            self.upper = merge(opt.lower, { x: pinf, y: pinf });
            self.bound = {};
            [ 'x', 'y' ].forEach(function(p) {
                self.bound[p] = function(x) {
                    if (self.lower[p] > x) x = self.lower[p];
                    if (self.upper[p] < x) x = self.upper[p];
                    return x;
                };
            });
            self.isDragging = function(){ return !!self.o; };
            self.isListening = function(){ return !!self.l; };
            self.isDisposed = function(){ return !self.isListening(); };
            self.start = function(e) {
                if (!self.isListening()) return;
                self.pos.cursor = e.mousePos();
                if (self.callback.start(self.node, e, self.pos.cursor)) {
                    self.pos.node = getPosition(self.node);
                    self.o = [ new Observer(doc, 'onmousemove', self.move),
                               new Observer(doc, 'onmouseup', self.stop) ];
                    e.stop();
                }
            };
            self.move = function(e) {
                if (!self.isDragging() || self.isDisposed()) return;
                var pos = e.mousePos();
                if (self.callback.move(self.node, e, pos)) {
                    [ 'x', 'y' ].forEach(function(p) {
                        pos[p] += self.pos.node[p] - self.pos.cursor[p];
                        pos[p] = self.bound[p](pos[p]);
                    });
                    self.node.style.left = pos.x + 'px';
                    self.node.style.top = pos.y + 'px';
                    e.stop();
                }
            };
            self.stop = function(e) {
                if (!self.isDragging() || self.isDisposed()) return;
                self.o.forEach(function(o){ o.stop(); });
                self.o = null;
                self.pos = {};
                if (self.callback.end(self.node, e) && e) e.stop();
            };
            self.dispose = function(){ self.stopListening(); };
            self.startListening = function() {
                if (self.isListening()) return;
                self.l = new Observer(self.attach, 'onmousedown', self.start);
            };
            self.stopListening = function(abort) {
                if (!self.isListening()) return;
                self.l.stop();
                self.l = null;
                if (abort && self.isDragging()) self.stop();
            };
            if (!opt.later) self.startListening();
            return self;
        };
        ns.Resizer = function(parent, opt) {
            var self = { parent: $(parent) };
            if (self.parent.parentNode.className == '_resizable') {
                self.target = self.parent;
                self.parent = self.parent.parentNode;
            } else {
                var outer = $new('div', { klass: '_resizable', style: {
                    position: 'relative'
                } });
                self.parent.parentNode.replaceChild(outer, self.parent);
                outer.appendChild(self.parent);
                self.target = self.parent;
                self.parent = outer;
            }
            opt = opt || {};
            opt = merge(opt||{}, { zIndex: 100, position: 'corner' });

            var px = function(x){ return x+'px'; };
            var getPositonalStyle = function(node, what, post) {
                var get = function(which) {
                    return parseInt(getStyle(node, what+which+(post||''))||
                                    getStyle(node, what+(post||''))||'0')||0;
                };
                var hash = { left: get('Left'), top: get('Top'),
                             right: get('Right'), bottom: get('Bottom') };
                hash.w = hash.left + hash.right;
                hash.h = hash.top + hash.bottom;
                return hash;
            };
            var getBorder = function(node) {
                return getPositonalStyle(node, 'border', 'Width');
            };
            var getPadding = function(node, which) {
                return getPositonalStyle(node, 'padding');
            };
            var getSize = function(node) {
                var border = getBorder(node); var padding = getPadding(node);
                return { w: node.offsetWidth - border.w - padding.w,
                         h: node.offsetHeight - border.h - padding.h };
            };
            var resize = function(who, size, delta) {
                var node = self[who];
                node.style[size] = px(getSize(node)[size.charAt(0)] + delta);
            };
            var rW = function(d){ resize('parent', 'width', d.x); };
            var rH = function(d){ resize('target', 'height', d.y); };

            var style = {}; var b = getBorder(self.target); var m=px(-2);
            switch (opt.position) {
            case 'right': self.resize = function(d){ rW(d); }; style = {
                cursor: 'e-resize', zIndex: opt.zIndex, right: m, top: 0,
                width: px((b.right||2)+2), height: '100%'
            }; break;
            case 'bottom': self.resize = function(d){ rH(d); }; style = {
                cursor: 's-resize', zIndex: opt.zIndex, left: 0, bottom: m,
                width: '100%', height: px((b.bottom||2)+2)
            }; break;
            case 'corner':
            default: self.resize = function(d){ rW(d); rH(d); }; style = {
                cursor: 'se-resize', zIndex: opt.zIndex,
                right: m, bottom: m
            }; break;
            }
            self.node = $new('div', { style: merge(style, {
                position: 'absolute', backgroundColor: 'transparent'
            }), klass: 'resize-'+opt.position });
            if (opt.handle) self.node.appendChild($node(opt.handle));
            self.parent.appendChild(self.node);

            self.destroy = function(){ self.parent.removeChild(self.node); };

            new Draggable(self.node, { callback: {
                start: function(node, e, pos){ self.pos = pos; return true; },
                move: function(node, e, pos) {
                    self.resize({ x: pos.x-self.pos.x, y: pos.y-self.pos.y });
                    self.pos = pos;
                    return false;
                }
            } });
            return self;
        };
        ns.Console = function(parent, cmd) {
            var History = function(hist, index) {
                var self = { hist: hist||[], index: index||-1 };
                self.prev = function() {
                    if (self.index < self.hist.length) self.index++;
                    return self.hist[self.index] || '';
                };
                self.next = function() {
                    if (self.index >= 0) self.index--;
                    return self.hist[self.index] || '';
                };
                self.push = function(item) {
                    if (item && self.hist[0] != item) self.hist.unshift(item);
                };
                self.clone = function(){ return History(self.hist, -1); };
                return self;
            };
            var self = {
                view: $new('ul'), parent: parent, promptChar: '>',
                history: new History(),
                command: cmd || function(){},
                resizer: {}
            };
            self.resizer.corner = new Resizer(parent, { handle: '\u25a0' });
            self.resizer.right = new Resizer(parent, { position: 'right' });
            self.resizer.bottom = new Resizer(parent, { position: 'bottom' });
            self.enclosing = parent.parentNode;
            parent.appendChild(self.view);
            self.destroy = function() {
                self.parent.removeChild(self.view);
                [ 'corner', 'right', 'bottom' ].forEach(function(which) {
                    self.resizer[which].destroy();
                });
            };
            self.clear = function(node) {
                removeAllChildren(self.view);
                if (node) self.view.appendChild(node);
                if (self.input) self.input.focus();
                return self;
            };
            self.insert = function() {
                var li = $new('li');
                for (var i=0; i < arguments.length; i++) {
                    var node = $node(arguments[i]);
                    li.appendChild(node);
                }
                self.view.appendChild(li);
                self.parent.scrollTop = self.parent.scrollHeight;
                return li;
            };
            self.err = function(message) {
                var li = self.insert(message);
                li.className = 'error';
                return li;
            };
            self.prompt = function() {
                var p = $new('span', {
                    klass: 'prompt', child: self.promptChar
                });
                self.input = $new('input');
                self.input.value = '';
                var li = self.insert(p, self.input);
                var inputPos = getPosition(self.input);
                var viewPos = getPosition(self.view);
                self.inputMargin = inputPos.x - viewPos.x + 2;
                self.reposition();
                var history = self.history.clone();
                new Observer(self.input, 'onkeyup', function(e) {
                    switch (e.event.charCode || e.event.keyCode) {
                    case 13: // Enter
                        var text = self.input.value;
                        self.history.push(text);
                        self.view.removeChild(li);
                        self.input = null;
                        self.insert(p, text).className = 'userinput';
                        setTimeout(function(){ self.command(text); }, 0);
                        break;
                    default:
                        return;
                    }
                    e.stop();
                });
                new Observer(self.input, 'onkeydown', function(e) {
                    var evnt = e.event;
                    switch (evnt.charCode || evnt.keyCode) {
                    case 'L'.charCodeAt(0): if (!evnt.ctrlKey) return; // C-L
                        self.clear(li);
                        break;
                    case 'P'.charCodeAt(0): if (!evnt.ctrlKey) return; // C-P
                    case 38: // up
                        self.input.value = history.prev();
                        break;
                    case 'N'.charCodeAt(0): if (!evnt.ctrlKey) return; // C-N
                    case 40: // down
                        self.input.value = history.next();
                        break;
                    case 220: // '\\'
                        insertText(self.input, '\u03bb');
                        break;
                    default:
                        return;
                    }
                    e.stop();
                });
                self.input.focus();
                return self;
            };
            self.reposition = function() {
                if (self.input) {
                    var width = self.view.offsetWidth - self.inputMargin;
                    self.input.style.width = width+'px';
                }
            };
            [ 'corner', 'right', 'bottom' ].forEach(function(p) {
                var fun = self.resizer[p].resize;
                self.resizer[p].resize = function() {
                    fun.apply(self.resizer[p], arguments);
                    self.reposition();
                };
            });
            return self;
        };
    }
})(UI);
