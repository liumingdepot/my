export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith('.js')) {
    try {
      return await nextResolve(specifier, context)
    } catch {
      return nextResolve(specifier.replace(/\.js$/, '.ts'), context)
    }
  }
  return nextResolve(specifier, context)
}
