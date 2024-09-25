using opnetcli.Commands.Interfaces;
using opnetcli.Helpers;
using System.Reflection;

namespace opnetcli.Commands;

public class CommandFactory
{
    private static readonly Dictionary<string, Type> _commands = new Dictionary<string, Type>();

    static CommandFactory()
    {
        IOPNETConsole console = new OPNETConsole();

        var commandTypes = Assembly.GetExecutingAssembly().GetTypes()
                                   .Where(t => typeof(ICommand).IsAssignableFrom(t) && !t.IsInterface && !t.IsAbstract);

        foreach (var type in commandTypes)
        {
            var commandInstance = (ICommand)Activator.CreateInstance(type, console);

            _commands.Add(commandInstance.Name.ToLower(), type);
        }
    }

    public static ICommand CreateCommand(string commandName,
        IOPNETConsole console)
    {
        if (_commands.TryGetValue(commandName.ToLower(), out var commandType))
        {
            return (ICommand)Activator.CreateInstance(commandType, console);
        }
        else
        {
            return null;
        }
    }

    public static bool CommandExists(string commandName)
    {
        return _commands.ContainsKey(commandName.ToLower());
    }
}
