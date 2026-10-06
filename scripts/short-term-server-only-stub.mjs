// The private CLI runs in Node, never in a browser bundle. This scoped stub
// keeps Next's server-only sentinel from treating the CLI loader as client code.
export {};
