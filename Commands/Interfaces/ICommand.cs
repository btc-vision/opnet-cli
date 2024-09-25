namespace opnetcli.Commands.Interfaces;

public interface ICommand
{
    string Name { get; }
    void Execute(ParsedResults parsedResult);
}
