# AGENTS.md

## Scope

These instructions apply to the entire repository.

## Code style

- Prefer explicit, readable control flow over compact one-line statements.
- Always use braces for `if`, `else`, `for`, `while`, `try`, and `catch` blocks, even when the body contains only one statement.
- Put the body of a control-flow block on its own line. Do not write a return or assignment on the same line as the condition.

Preferred:

```js
if( ![threshold, previous, current].every(Number.isFinite) ) {
	return false;
}
```

Avoid:

```js
if (![threshold, previous, current].every(Number.isFinite)) return false;
```

- Keep opening braces on the same line as the declaration or condition.
- Use early returns when they make the happy path easier to read, but format them as full blocks.
- Add blank lines between distinct logical sections of a method.
- Prefer clear intermediate variables over deeply nested or overly dense expressions.
- Follow the indentation already used by the file. The app and driver files primarily use tabs.
- Preserve the surrounding quote and semicolon style when modifying an existing file; do not reformat unrelated code.
- Keep comments focused on intent, data units, API behavior, or non-obvious decisions.

## Homey app conventions

- Edit Homey Compose source files under `.homeycompose/` and `drivers/*/*.compose.json`. Do not edit generated sections of `app.json` manually.
- Register app-level Flow cards through `this.homey.flow`, not `this.flow`.
- Keep existing Flow card IDs stable to avoid breaking users' Flows.
- Flow conditions and actions must use the device selected in the Flow through `args.device`.
- Treat inverter, meter, and battery API values as untrusted input. Validate values with `Number.isFinite()` before updating capabilities or evaluating Flows.
- Preserve the documented power direction conventions:
  - Battery power: positive is charging; negative is discharging.
  - Grid power: positive is importing; negative is exporting.
- Avoid firing state-transition cards on every polling cycle. Fire only when the state or configured threshold is crossed.
- Use hysteresis around zero-power state transitions so minor measurement fluctuations do not repeatedly trigger Flows.

## Validation

After JavaScript changes, run syntax checks on every changed JavaScript file:

```sh
node --check path/to/changed-file.js
```

After Homey Compose or Flow-card changes, regenerate and validate the manifest:

```sh
npx homey app validate
```

Before finishing, also run:

```sh
git diff --check
```
