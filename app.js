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

        var st = new LambdaJS.Strategy.Leftmost();
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
    ns.Selector = function(cat, action, dflt) {
        var self = { hash: {} };
        for (var key in LambdaJS[cat]) {
            var obj = new LambdaJS[cat][key]();
            self.hash[obj.name] = { key: key };
        }
        var name = cat.toLowerCase();
        with (UI) {
            var ul = $(name);
            for (var label in self.hash) {
                var key = self.hash[label].key;
                var selected = (key==dflt || label==dflt);
                var a = $new('a', { child: label }); a.href = '.';
                var li = $new('li', {
                    id: name+key, klass: selected ? 'selected' : '', child: a
                });
                self.hash[label].li = li;
                ul.appendChild(li);
                if (selected) action(key);
                addEvent(a, 'onclick', (function(li) {
                    return function(e) {
                        for (var label in self.hash) {
                            if (label == li.textContent) {
                                li.className = 'selected';
                                action(self.hash[label].key);
                            } else {
                                self.hash[label].li.className = '';
                            }
                        }
                        e.preventDefault();
                        e.stopPropagation();
                    };
                })(li));
            }
            return self;
        }
    };
    ns.Repl = function(elm) {
        var self = {
            getWait: function(){ return 500; },
            getStrategy: function() {
                return new LambdaJS.Strategy.Leftmost();
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
                        var marker = self.getPP();
                        UI.replaceLastChild(self.console.view.lastChild,
                                            marker.pp(self.exp));
                        self.reduce(marker);
                    }, self.getWait());
                    return true;
                }
            }, self.cont);
        };
        self.reduce = function(marker) {
            self.sandbox(function() {
                var strategy = self.getStrategy();
                self.exp = strategy.reduceMarked(self.exp);
                if (strategy.reduced) {
                    var red = UI.$new('span', {
                        klass: 'reduce',
                        child: '\u2192'
                    });
                    setTimeout(function() {
                        self.console.insert(red, marker.pp(self.exp));
                        self.mark();
                    }, self.getWait());
                } else {
                    marker.setCallback(function(){ self.mark(); });
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

        // strategy
        new Selector('Strategy', function(key) {
            repl.getStrategy = function() {
                return new LambdaJS.Strategy[key];
            };
            if (repl.console.input) repl.console.input.focus();
        }, 'Leftmost');

        // output
        if (!isJS18Enabled()) delete LambdaJS.PP.JavaScript18;
        new Selector('PP', function(key) {
            repl.getPP = function() {
                return new LambdaJS.PP[key];
            };
            if (repl.console.input) repl.console.input.focus();
        }, 'JavaScript');

        // wait
        var ul = UI.$('pp');
        ul.appendChild(UI.$new('li', { klass: 'label', child: 'Wait:' }));
        var input = UI.$new('input', { id: 'wait' });
        input.value = 500;
        ul.appendChild(input);
        repl.getWait = function(){ return input.value; };
    }
};
