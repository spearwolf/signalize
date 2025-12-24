# Introduction to @spearwolf/signalize

`@spearwolf/signalize` is a lightweight, standalone JavaScript library designed to bring **fine-grained reactivity** to your applications through **signals** and **effects**.

It is built to be **framework-agnostic**, meaning you can use it in any JavaScript or TypeScript environment—whether it's a browser-based web app, a Node.js server, or even within other frameworks.

## Key Features

- **🚀 Standalone & Lightweight**: No external dependencies. It does one thing and does it well.
- **🛡️ Type-Safe**: Written in TypeScript with first-class type support.
- **✨ Modern API**: Supports both a functional API and a class-based API using standard [TC39 decorators](https://github.com/tc39/proposal-decorators).
- **⚡ High Performance**: Fine-grained updates mean only the parts of your app that *need* to update will update.
- **🚫 No Side-Effects**: Targets ES2023 environments and is side-effect free.

## Core Concepts

The library revolves around four main concepts:

### 1. Signals 📢
Signals are the atoms of state. They hold values that can change over time. When a signal's value changes, it notifies any "listeners" that depend on it. Think of them as reactive variables.

### 2. Effects ⚡
Effects are functions that automatically run whenever the signals they depend on change. They "subscribe" to signals simply by reading them. This is how you create side effects like updating the DOM, making network requests, or logging data in response to state changes.

### 3. Memos 🧠
Memos (or computed signals) are values derived from other signals. They are automatically updated when their dependencies change, but they are also cached—so they only re-compute when necessary.

### 4. Links (Connections) 🔗
Inspired by visual programming environments like Unreal Engine's Blueprints and Blender's shader graph editor, links create explicit one-way data flows between signals. They enable you to build modular, graph-like architectures where signals act as nodes with inputs and outputs. Combined with Signal Groups, you can organize signals into reusable modules and manage complex reactive systems with clear, declarative connections.

## Why @spearwolf/signalize?

Reactivity is the secret sauce of modern UI development. While many frameworks (like React, Vue, Solid) have their own reactivity systems, they are often tied to the framework itself.

`@spearwolf/signalize` gives you that same power but **unlocked**. You can use it to:
- Manage global state in a vanilla JS app.
- Build a reactive game engine.
- Create a custom reactive UI library.
- Add reactivity to a legacy codebase without a full rewrite.

It provides a clean, simple mental model: **State changes -> Effects run.** No complex boilerplate, just pure reactivity.
