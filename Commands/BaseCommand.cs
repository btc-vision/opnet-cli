using opnetcli.Commands.Interfaces;
using opnetcli.Helpers;

namespace opnetcli.Commands;

public abstract class BaseCommand : ICommand
{
    protected readonly IOPNETConsole _console;

    public abstract string Name { get; }

    public BaseCommand(IOPNETConsole console)
    {
        _console = console;
    }

    public abstract void Execute(ParsedResults parsedResult);

    protected abstract List<CommandValidationResult> ValidateCommandLine(ParsedResults parsedResult);
}
