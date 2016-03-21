## jrq

Pronounced `jerk`, `jrq` is a [json(1)](https://github.com/trentm/json) inspired
(nearly drop in replacement) command line tool for parsing JSON on the command
line and is intended to be delivered as a single executable.

Built using [duktape](http://duktape.org) and a custom JSON parser, some of the
internal interfaces are inspired by Node.js models (namely Streams and
EventEmitter).

## Why not json(1)?

A very good question, I love using `json` -- though sometimes people find it
frustrating and cumbersome to ship around an install of Node.js in a way that
makes using `json` easy.

## But then why not jq?

Also an excellent question, and quite the useful utility. I simply find the
syntax for it too much a bar for teaching other people. I want to be able to
express some predicates and mutations in JavaScript and rely on the shell for
doing the functional map/reduce style pipelines.

## Why not Go or Rust or FancyLangHere

Your favorite language is great, you should continue to write software in it.
Write code you want to maintain.

For me, that means having an ecosystem that is portable, debuggable, and simple
(comfortable) for me. What you get when you shake that all up is C and
JavaScript.

## Why your own JSON parser?

Many tools will rehydrate JSON back into an Object and perform a lookup on that
object. However if you're dealing with very large or deeply nested Object, this
can be rather expensive (both in CPU and memory). If your queries per object
involve only "value types" there is no need for `jrq` to rehydrate that object,
and it's merely stream parsing.

This does come with a significant disadvantage of now we have to fully test the
notion of our own parser (which we don't currently do well) and there will
certainly be new rough edges we're unaware of.

No work has been done to compare/contrast against the internal implementation of
`JSON.parse` though that would be interesting.

The implemented parser is implemented in a recursive descent model, relying on
the call stack to handle nested Objects and Arrays. Strictly speaking we don't
need to use the call stack for this, and there may come a time when this should
be fixed -- but for now, focusing on correctness and then later performance.

The irony of that last sentence is hilarious, focusing on correctness first and
then performance, but you wrote your own `JSON.parse`? Yes, I'm still an
engineer -- something about this has to be interesting to me.

## Gaps between jrq and json(1)

We currently don't support well the notion of `-g` (grouping near objects) or
`-M` (item evaluation) though both of these are requirements for a completed
tool.

Neither `-c` (conditionals) or `-e` (evaluations) are implemented yet, though
it's not entirley clear if `-e` will be able to work without fully rehydrating
each object.

`json(1)` supports the notion of negative array lookups (Python style), it will
be hard to support this without fully rehydrating the object, so it's likely to
be an incompatibility.

## Testing

Testing is currently done by using the `json(1)` test suite, and the minimal
amount of tests available in this repository. It's likely we'll import a portion
of the tests directly from `json(1)` for easier testing.
