if (typeof LambdaJS == 'undefined') var LambdaJS = {};

(function(ns) {
    var $ = function(id) {
        return ns.UI.doc.getElementById(id);
    };
    var $new = function(tag, args) {
        var elm = ns.UI.doc.createElement(tag);
        args = args || {};
        if (args.id) elm.id = args.id;
        if (args.klass) elm.className = args.klass;
        if (args.style) {
            for (var prop in args.style) {
                elm.style[prop] = args.style[prop];
            }
        }
        if (args.child) {
            if (typeof args.child != 'Array') args.child = [ args.child ];
            for (var i=0; i < args.child.length; i++) {
                elm.appendChild(args.child[i]);
            }
        }
        return elm;
    };
    var $text = function(str){ return ns.UI.doc.createTextNode(str); };

    ns.UI = {
        setup: function(doc, elm) {
            ns.UI.doc = doc;
            ns.UI.console = new ns.UI.Console(elm);
            return ns.UI.console;
        },
        Util: {
            addEvent: function(element, event, func) {
                if (element.addEventListener) {
                    if (event.indexOf('on') == 0) {
                        event = event.substr(2);
                    }
                    element.addEventListener(event, func, false);
                } else if (element.attachEvent) {
                    element.attachEvent(event, func);
                }
            }
        },
        Console: function(elm) {
            var self = {
                view: $new('ul'),
                promptChar: '>',
                env: new ns.Env(),
                command: function(cmd){}
            };
            elm.appendChild(self.view);
            self.insert = function() {
                var li = $new('li');
                for (var i=0; i < arguments.length; i++) {
                    var elm = arguments[i];
                    if (!(elm instanceof Node)) elm = $text(elm);
                    li.appendChild(elm);
                }
                self.view.appendChild(li);
                return li;
            };
            self.err = function(message) {
                self.insert(message).className = 'error';
            };
            self.prompt = function() {
                var p = $new('span', {
                    klass: 'prompt',
                    child: $text(self.promptChar)
                });
                self.input = $new('input');
                self.input.value = '';
                var li = self.insert(p, self.input);
                ns.UI.Util.addEvent(self.input, 'onkeyup', function(e) {
                    if (e.keyCode == 13) { // enter
                        var text = self.input.value;
                        self.view.removeChild(li);
                        self.insert(p, text).className = 'userinput';
                        try {
                            self.command(text);
                        } catch (e) {
                            var meta = [];
                            [ 'fileName', 'lineNumber' ].forEach(function(x) {
                                if (/^([a-z]+)/.test(x) && e[x])
                                    meta.push(RegExp.$1 + ': ' + e[x]);
                            });
                            meta = meta.length ? ' ['+meta.join(', ')+']' : '';
                            self.err(e.message + meta);
                        }
                        self.prompt();
                    }
                });
                self.input.focus();
            };
            self.prompt();
            return self;
        }
    };
})(LambdaJS);

function ui(id) {
    var elm = document.getElementById(id);
    var console = LambdaJS.UI.setup(document, elm);
    var env = new LambdaJS.Env();
    console.command = function(cmd) {
        var exp = env.evalLine(cmd);
        if (exp) {
            var st = new LambdaJS.Strategy.NormalOrder();
            do {
                console.insert(exp.toString());
                exp = st.reduce(exp);
            } while (st.reduced)
        }
    };
};
