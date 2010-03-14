function run(id) {
    var code = document.getElementById(id);

    var parser = new LambdaJS.Parser();
    var parsed = parser.parse(code.textContent);
    var sandbox = new LambdaJS.Sandbox();

    var exp = sandbox.run(parsed.join(''));

    code.appendChild(document.createElement('br'));
    while (true) {
        code.appendChild(document.createElement('br'));
        code.appendChild(document.createTextNode((exp||'').toString()));
        if (typeof exp == 'undefined') break;

        var st = new LambdaJS.Strategy.CallByName();
        exp = st.reduce(exp);
        if (!st.reduced) break;
    }

    var exp = sandbox.run(parsed.join(''));

    code.appendChild(document.createElement('br'));
    while (true) {
        code.appendChild(document.createElement('br'));
        code.appendChild(document.createTextNode((exp||'').toString()));
        if (typeof exp == 'undefined') break;

        var st = new LambdaJS.Strategy.CallByValue();
        exp = st.reduce(exp);
        if (!st.reduced) break;
    }

    var exp = sandbox.run(parsed.join(''));

    code.appendChild(document.createElement('br'));
    while (true) {
        code.appendChild(document.createElement('br'));
        code.appendChild(document.createTextNode((exp||'').toString()));
        if (typeof exp == 'undefined') break;

        var st = new LambdaJS.Strategy.NormalOrder();
        exp = st.reduce(exp);
        if (!st.reduced) break;
    }
};

function init() {
    var links = document.getElementsByTagName('a');
    for (var i=0; i < links.length; i++) {
        if (links[i].id.match(/^run-.+/)) {
            var href = "javascript:run('$1')";
            links[i].href = links[i].id.replace(/^run-(.+)$/, href);
        }
    }
};

if (typeof LambdaJS == 'undefined') var LambdaJS = {};
if (typeof LambdaJS.App == 'undefined') LambdaJS.App = {};

(function(ns) {
    ns.testJS18 = function() {
        return [
            '(function(x) x)(1)',
            'let x = 1'
        ].every(function(t) {
            try {
                eval(t);
                return true;
            } catch (e) {
                return false;
            }
        });
    };
    ns.isJS18Enabled = function() {
        if (typeof ns._isJS18Enabled == 'undefined') {
            ns._isJS18Enabled = ns.testJS18();
        }
        return ns._isJS18Enabled;
    };
    ns.hideSyntax = function(table, hide) {
        var hideCols = function(table, i) {
            for (var j=0; j < table.rows.length; j++) {
                var row = table.rows[j];
                if (row) {
                    var elm = row.cells[i];
                    if (elm) elm.style.display = 'none';
                }
            }
        };
        var head = table.rows[0];
        if (!head) return;
        for (var i=0; i < head.cells.length; i++) {
            if (head.cells[i].className == hide) {
                hideCols(table, i);
                break;
            }
        }
    };
    ns.EvalPrint = function(console, exp, strategy, pp, cont, timeout) {
        var self = {
            console: console,
            exp: exp, strategy: strategy,
            pp: pp,
            cont: cont,
            timeout: timeout
        };
        self.mark = function() {
            window.setTimeout(function(){ self._mark(); }, self.timeout);
        };
        self.reduce = function() {
            window.setTimeout(function(){ self._reduce(); }, self.timeout);
        };
        self.sandbox = function(fun, cont) {
            try {
                if (fun()) return;
            } catch (e) {
                var meta = [];
                [ 'fileName', 'lineNumber' ].forEach(function(x) {
                    if (/^([a-z]+)/.test(x) && e[x])
                        meta.push(RegExp.$1 + ': ' + e[x]);
                });
                meta = meta.length ? ' ['+meta.join(', ')+']' : '';
                self.console.err(e.message + meta);
            }
            cont();
        };
        self._mark = function() {
            self.sandbox(function() {
                self.exp = strategy.mark(self.exp);
                if (self.strategy.marked) {
                    UI.replaceLastChild(self.console.view.lastChild,
                                        self.pp.pp(self.exp));
                    self.reduce();
                    return true;
                }
            }, self.cont);
        };
        self._reduce = function() {
            self.sandbox(function() {
                self.exp = strategy.reduceMarked(self.exp);
                if (self.strategy.reduced) {
                    var red = UI.$new('span', {
                        klass: 'reduce',
                        child: '\u2192'
                    });
                    self.console.insert(red, self.pp.pp(self.exp));
                    self.mark();
                }
                return true;
            }, self.cont);
        };
        return self;
    };
})(LambdaJS.App);

function setup(id) {
    with (LambdaJS.App) {
        // hide unsupported syntax
        hideSyntax(document.getElementById('syntax'),
                   isJS18Enabled() ? 'javascript' : 'javascript18');

        init(); // FIXME

        // REPL
        var elm = document.getElementById(id);
        var env = new LambdaJS.Env();
        var console = new UI.Console(elm, function(cmd) {
            var exp = env.evalLine(cmd);
            if (exp) {
                var st = new LambdaJS.Strategy.NormalOrder();
                var pp = new LambdaJS.PP.Lambda();
                console.insert(pp.pp(exp));

                var ep = new EvalPrint(console, exp, st, pp, function() {
                    console.prompt();
                }, 500); // FIXME
                ep.mark();
            } else {
                console.prompt();
            }
        }).prompt();
    }
};
