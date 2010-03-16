if (typeof UI == 'undefined') var UI = {};

(function(ns) {
    ns.doc = ns.doc || document;
    ns.$ = function(id) {
        return ns.doc.getElementById(id);
    };
    ns.$new = function(tag, args) {
        var elm = ns.doc.createElement(tag);
        args = args || {};
        if (args.id) elm.id = args.id;
        if (args.klass) elm.className = args.klass;
        if (args.style) {
            for (var prop in args.style) {
                elm.style[prop] = args.style[prop];
            }
        }
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
    ns.$node = function(node) {
        return (node instanceof Node) ? node : ns.$text(node);
    }
    ns.addEvent = function(element, event, func) {
        if (element.addEventListener) {
            if (event.indexOf('on') == 0) {
                event = event.substr(2);
            }
            element.addEventListener(event, func, false);
        } else if (element.attachEvent) {
            element.attachEvent(event, func);
        }
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
    ns.getPosition = function(node) {
        var pos = {x:0, y:0};
        do {
            pos.x += node.offsetLeft;
            pos.y += node.offsetTop;
        } while (node = node.offsetParent);
        return pos;
    };
    ns.removeAllChildren = function(node) {
        while (node.firstChild) node.removeChild(node.firstChild);
    };
    ns.replaceLastChild = function(node, child) {
        var last = node.lastChild;
        if (last) node.removeChild(last);
        node.appendChild(child);
    };
    ns.History = function(hist, index) {
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
        self.clone = function(){ return ns.History(self.hist, -1); };
        return self;
    };
    with (ns) {
        ns.Console = function(elm, cmd) {
            var self = {
                view: $new('ul'),
                promptChar: '>',
                history: new History(),
                command: cmd || function(){}
            };
            elm.appendChild(self.view);
            self.clear = function(elm) {
                removeAllChildren(self.view);
                if (elm) self.view.appendChild(elm);
                if (self.input) self.input.focus();
                return self;
            };
            self.insert = function() {
                var li = $new('li');
                for (var i=0; i < arguments.length; i++) {
                    var elm = $node(arguments[i]);
                    li.appendChild(elm);
                }
                self.view.appendChild(li);
                var parent = self.view.parentNode;
                parent.scrollTop = parent.scrollHeight;
                return li;
            };
            self.err = function(message) {
                var li = self.insert(message);
                li.className = 'error';
                return li;
            };
            self.prompt = function() {
                var p = $new('span', {
                    klass: 'prompt',
                    child: self.promptChar
                });
                self.input = $new('input');
                self.input.value = '';
                var li = self.insert(p, self.input);
                var history = self.history.clone();
                addEvent(self.input, 'onkeyup', function(e) {
                    switch (e.charCode || e.keyCode) {
                    case 13: // Enter
                        var text = self.input.value;
                        self.history.push(text);
                        self.view.removeChild(li);
                        self.insert(p, text).className = 'userinput';
                        self.command(text);
                        break;
                    default:
                        return;
                    }
                    e.preventDefault();
                    e.stopPropagation();
                });
                addEvent(self.input, 'onkeydown', function(e) {
                    switch (e.charCode || e.keyCode) {
                    case 'L'.charCodeAt(0): if (!e.ctrlKey) return; // C-L
                        self.clear(li);
                        break;
                    case 'P'.charCodeAt(0): if (!e.ctrlKey) return; // C-P
                    case 38: // up
                        self.input.value = history.prev();
                        break;
                    case 'N'.charCodeAt(0): if (!e.ctrlKey) return; // C-N
                    case 40: // down
                        self.input.value = history.next();
                        break;
                    case 220: // '\\'
                        insertText(self.input, '\u03bb');
                        break;
                    default:
                        return;
                    }
                    e.preventDefault();
                    e.stopPropagation();
                });
                self.input.focus();
                return self;
            };
            return self;
        };
    }
})(UI);
