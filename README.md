# web-uuid

This is a a fork of [node-uuid](https://github.com/broofa/node-uuid) that includes only the browser component. Why? It turns out that although node-uuid is tiny, it contributes 50k when built with webpack. This is due to pulling in the nodejs `Buffer` class and `crypto` module. With these parts taken out, the library works the same, but weighs only ~8k.
