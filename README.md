# browser-uuid

This is a a fork of [node-uuid](https://github.com/broofa/node-uuid). It removes some code so that the library works only in the browser. Why? It turns out that although node-uuid is tiny, it contributes 50k when built with webpack. This is due to pulling in the nodejs `Buffer` class and `crypto` module. With these parts taken out, the library works the same, but weighs only ~8k.
