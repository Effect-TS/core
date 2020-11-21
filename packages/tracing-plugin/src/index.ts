import * as path from "path"
import * as ts from "typescript"

export interface TracingOptions {
  tracingModule?: string
  relativeToRoot?: string
}

export default function tracingPlugin(_program: ts.Program, _opts: TracingOptions) {
  return {
    before(ctx: ts.TransformationContext) {
      return (sourceFile: ts.SourceFile) => {
        const checker = _program.getTypeChecker()
        let tracingModule = _opts.tracingModule || "@effect-ts/core/Tracing"
        const entryDir = path.join(__dirname, _opts.relativeToRoot || "../")
        const file = sourceFile.fileName.replace(entryDir, "")

        const factory = ctx.factory

        const tracingFactory = factory.createUniqueName("TRACER")
        const tracingFileNameFactory = factory.createUniqueName("FILE_NAME")

        const traceRegex = /\/\/ trace: on/
        const overrideRegex = /\/\/ tracingModule: (.*)/

        const tracingEnabled = traceRegex.test(sourceFile.getFullText())

        const overrideMatches = overrideRegex.exec(sourceFile.getFullText())

        if (overrideMatches) {
          tracingModule = overrideMatches[1]
        }

        function visitor(node: ts.Node): ts.Node {
          if (tracingEnabled && ts.isCallExpression(node)) {
            const symbol = checker.getTypeAtLocation(node.expression).getSymbol()
            const overloadDeclarations = checker
              .getResolvedSignature(node)
              ?.getDeclaration()

            const overloadArgsToTrace = overloadDeclarations
              ? ts
                  .getAllJSDocTags(
                    overloadDeclarations,
                    (t): t is ts.JSDocTag => t.tagName.getText() === "trace"
                  )
                  .map((e) => e.comment)
                  .filter((s): s is string => s != null)
              : undefined

            const argsToTrace_ =
              symbol
                ?.getDeclarations()
                ?.map((e) =>
                  ts
                    .getAllJSDocTags(
                      e,
                      (t): t is ts.JSDocTag => t.tagName.getText() === "trace"
                    )
                    .map((e) => e.comment)
                )
                .reduce((flatten, entry) => flatten.concat(entry), []) || []

            const useOverloads =
              overloadArgsToTrace && overloadArgsToTrace.length > 0 ? true : false

            const argsToTrace =
              overloadArgsToTrace && useOverloads ? overloadArgsToTrace : argsToTrace_

            if (argsToTrace.length > 0) {
              const method =
                useOverloads && overloadDeclarations
                  ? ts.getNameOfDeclaration(overloadDeclarations)?.getText() ||
                    "undefined"
                  : symbol
                      ?.getDeclarations()
                      ?.map((e) => ts.getNameOfDeclaration(e)?.getText())
                      .filter((name) => name && name?.length > 0)[0] || "unknown"

              const context =
                useOverloads && overloadDeclarations
                  ? ts
                      .getAllJSDocTags(
                        overloadDeclarations,
                        (t): t is ts.JSDocTag => t.tagName.getText() === "module"
                      )
                      .map((e) => e.comment)[0] || "unknown"
                  : symbol
                      ?.getDeclarations()
                      ?.map((e) =>
                        ts
                          .getAllJSDocTags(
                            e,
                            (t): t is ts.JSDocTag => t.tagName.getText() === "module"
                          )
                          .map((e) => e.comment)
                      )
                      .reduce((flatten, entry) => flatten.concat(entry), [])[0] ||
                    "unknown"

              const named =
                useOverloads && overloadDeclarations
                  ? ts
                      .getAllJSDocTags(
                        overloadDeclarations,
                        (t): t is ts.JSDocTag => t.tagName.getText() === "named"
                      )
                      .map((e) => e.comment)[0] || undefined
                  : symbol
                      ?.getDeclarations()
                      ?.map((e) =>
                        ts
                          .getAllJSDocTags(
                            e,
                            (t): t is ts.JSDocTag => t.tagName.getText() === "named"
                          )
                          .map((e) => e.comment)
                      )
                      .reduce((flatten, entry) => flatten.concat(entry), [])[0] ||
                    undefined

              const isSuspend = argsToTrace.includes("suspend")
              const isAppend = argsToTrace.includes("append")

              if (isAppend) {
                const { character, line } = sourceFile.getLineAndCharacterOfPosition(
                  node.getStart()
                )
                return ts.visitEachChild(
                  factory.createCallExpression(node.expression, node.typeArguments, [
                    ...node.arguments,
                    factory.createBinaryExpression(
                      tracingFileNameFactory,
                      factory.createToken(ts.SyntaxKind.PlusToken),
                      factory.createStringLiteral(
                        `:${line + 1}:${character + 1}:${context}:${
                          named ? named : method
                        }`
                      )
                    )
                  ]),
                  visitor,
                  ctx
                )
              }

              if (isSuspend) {
                const { character, line } = sourceFile.getLineAndCharacterOfPosition(
                  node.getStart()
                )
                return factory.createCallExpression(
                  factory.createCallExpression(
                    factory.createPropertyAccessExpression(
                      tracingFactory,
                      factory.createIdentifier("traceSuspend")
                    ),
                    undefined,
                    [
                      factory.createBinaryExpression(
                        tracingFileNameFactory,
                        factory.createToken(ts.SyntaxKind.PlusToken),
                        factory.createStringLiteral(
                          `:${line + 1}:${character + 1}:${context}:${
                            named ? named : method
                          }`
                        )
                      )
                    ]
                  ),
                  undefined,
                  [ts.visitEachChild(node, visitor, ctx)]
                )
              }

              return factory.createCallExpression(
                node.expression,
                node.typeArguments,
                node.arguments.map((x, i) => {
                  if (argsToTrace.includes("all") || argsToTrace.includes("" + i)) {
                    const {
                      character,
                      line
                    } = sourceFile.getLineAndCharacterOfPosition(
                      node.arguments[i].getStart()
                    )

                    return factory.createCallExpression(
                      factory.createPropertyAccessExpression(
                        tracingFactory,
                        factory.createIdentifier("traceF_")
                      ),
                      undefined,
                      [
                        ts.visitEachChild(node.arguments[i], visitor, ctx),
                        factory.createBinaryExpression(
                          tracingFileNameFactory,
                          factory.createToken(ts.SyntaxKind.PlusToken),
                          factory.createStringLiteral(
                            `:${line + 1}:${character + 1}:${context}:${
                              named ? named : method
                            }`
                          )
                        )
                      ]
                    )
                  }
                  return ts.visitEachChild(x, visitor, ctx)
                })
              )
            }
          }

          return ts.visitEachChild(node, visitor, ctx)
        }

        return ts.visitEachChild(
          tracingEnabled
            ? factory.updateSourceFile(sourceFile, [
                factory.createVariableStatement(
                  undefined,
                  factory.createVariableDeclarationList(
                    [
                      factory.createVariableDeclaration(
                        tracingFileNameFactory,
                        undefined,
                        undefined,
                        factory.createStringLiteral(file)
                      )
                    ],
                    ts.NodeFlags.Const
                  )
                ),
                factory.createImportDeclaration(
                  undefined,
                  undefined,
                  factory.createImportClause(
                    false,
                    undefined,
                    factory.createNamespaceImport(tracingFactory)
                  ),
                  factory.createStringLiteral(tracingModule)
                ),
                ...sourceFile.statements
              ])
            : sourceFile,
          visitor,
          ctx
        )
      }
    }
  }
}
