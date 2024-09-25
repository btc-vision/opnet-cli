using opnetcli.Helpers;

namespace opnetcli;

public class ParsedResults
{
    public string Command {  get; set; }
    public Dictionary<string, string> Parameters { get; } = new();

    public bool HasParameter(string parameter)
    {
        return Parameters.ContainsKey(parameter.ToLower());
    }

    public string GetValue(string parameter)
    {
        return Parameters.TryGetValue(parameter.ToLower(), out string value) ? value : null;
    }
}

public class CommandLineParser
{
    private readonly IOPNETConsole _console;

    public CommandLineParser(IOPNETConsole console)
    {
        _console = console;
    }

    public ParsedResults Parse(string[] args)
    {
        ParsedResults results = new();

        if (args.Length == 0)
        {
            throw new ArgumentException("No command specified.");
        }

        results.Command = args[0];

        for (int i = 1; i < args.Length; i++)
        {
            if (args[i].StartsWith("-"))
            {
                string argument = args[i].Substring(1);
                string parameterName = string.Empty;
                string parameterValue = string.Empty;

                if (argument.Contains(":"))
                {
                    int colonPosition = argument.IndexOf(':');

                    parameterName = argument.Substring(0, colonPosition);
                    parameterValue = argument.Substring(colonPosition + 1);
                }
                else
                {
                    parameterName = argument;
                }

                results.Parameters[parameterName.ToLower()] = parameterValue;
            }
            else
            {
                throw new ArgumentException($"{args[i]}is an invalid parameter. Parameters must start with a -");
            }
        }

        return results;
    }
}
