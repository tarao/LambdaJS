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

function initExample() {
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
    ns.Repl = function(elm) {
        var self = {
            getTimeout: function(){ return 500; },
            getStrategy: function() {
                return new LambdaJS.Strategy.NormalOrder();
            },
            getPP: function() {
                return new LambdaJS.PP.Lambda();
            },
            cont: function(){ self.console.prompt(); },
            env: new LambdaJS.Env()
        };
        self.console = new UI.Console(elm, function(cmd) {
            self.sandbox(function() {
                self.exp = self.env.evalLine(cmd);
                if (self.exp) {
                    self.strategy = self.getStrategy();
                    self.console.insert(self.getPP().pp(self.exp));
                    self.mark();
                } else {
                    self.cont();
                }
                return true;
            }, self.cont);
        });
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
        self.mark = function() {
            self.sandbox(function() {
                var strategy = self.getStrategy();
                self.exp = strategy.mark(self.exp);
                if (strategy.marked) {
                    setTimeout(function() {
                        UI.replaceLastChild(self.console.view.lastChild,
                                            self.getPP().pp(self.exp));
                        self.reduce();
                    }, self.getTimeout());
                    return true;
                }
            }, self.cont);
        };
        self.reduce = function() {
            self.sandbox(function() {
                var strategy = self.getStrategy();
                self.exp = strategy.reduceMarked(self.exp);
                if (strategy.reduced) {
                    var red = UI.$new('span', {
                        klass: 'reduce',
                        child: '\u2192'
                    });
                    setTimeout(function() {
                        self.console.insert(red, self.getPP().pp(self.exp));
                        self.mark();
                    }, self.getTimeout());
                }
                return true;
            }, self.cont);
        };
        self.cont();
        return self;
    };
})(LambdaJS.App);

function init(id) {
    with (LambdaJS.App) {
        // hide unsupported syntax
        hideSyntax(document.getElementById('syntax'),
                   isJS18Enabled() ? 'javascript' : 'javascript18');

        initExample(); // FIXME

        // REPL
        var elm = document.getElementById(id);
        var repl = new Repl(elm);
    }
};
