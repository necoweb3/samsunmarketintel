export function resolveCircleCliPath() {
  return process.env.CIRCLE_CLI_PATH ?? "circle";
}
