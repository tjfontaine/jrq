## jrq

Pronounced `jerk`, `jrq` is a [json(1)](https://github.com/trentm/json) inspired
command line tool for parsing JSON on the command line and is intended to be
delivered as a single executable.

It is a combination of [duktape](http://duktape.org) and
[oboejs](http://oboejs.com).

## Why not json(1)?

A very good question, I love using `json` -- though sometimes people find it
frustrating and cumbersome to ship around an install of Node.js and all the
modules necessary for `json`.

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
