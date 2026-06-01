# Theta Build

Branch: theta-build
Source commit: 9c73634
Purpose: Split the monolithic index.html into external CSS/JS/module files without changing app behavior.

Initial measured state:
- index.html size: 1,038,611 bytes
- index.html lines: 49,761
- Main CSS: lines 99-2133
- Body starts: line 2139
- Main JS: lines 15639-49355

Rule:
No behavior changes during first extraction pass.
