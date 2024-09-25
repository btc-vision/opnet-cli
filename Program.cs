using opnetcli.Commands;
using opnetcli.Exceptions;
using opnetcli.Helpers;
using System.Runtime.InteropServices;

namespace opnetcli;

internal class Program
{
    static void Main(string[] args)
    {
        IOPNETConsole console = new OPNETConsole();

        try
        {
            console.ResetColor();

            bool isWindows = RuntimeInformation.IsOSPlatform(OSPlatform.Windows);
            bool isMacOS = RuntimeInformation.IsOSPlatform(OSPlatform.OSX);
            bool isLinux = RuntimeInformation.IsOSPlatform(OSPlatform.Linux);

            console.WriteLine("OPNETCLI: Version 0.0.0.2 - alpha");
            console.WriteLine("OPNETCLI: Copyright (C) 2024");

            if (isLinux)
            {
                console.WriteLine("OPNETCLI: Linux detected",
                    ConsoleColor.Green);
            }
            else if (isMacOS)
            {
                console.WriteLine("OPNETCLI: MacOS detected",
                    ConsoleColor.Green);
            }
            else if (isWindows)
            {
                console.WriteLine("OPNETCLI: Windows detected",
                    ConsoleColor.Green);
            }
            else
            {
                throw new Exception("Unsupported OS");
            }

            console.ResetColor();

            CommandLineParser parser = new CommandLineParser(console);

            var parsedResults = parser.Parse(args);

            if (CommandFactory.CommandExists(parsedResults.Command))
            {
                var command = CommandFactory.CreateCommand(parsedResults.Command,
                    console);

                command.Execute(parsedResults);
            }
            else
            {
                console.WriteLine($"OPNETCLI: {parsedResults.Command} is not a valid command.",
                    ConsoleColor.Red);
            }
        }
        catch (CommandValidationException ex)
        {
            foreach (var result in ex.ValidationResults)
            {
                console.WriteLine($"OPNETCLI: {result.Message}",
                    ConsoleColor.Red);
            }
        }
        catch (Exception ex)
        {
            console.WriteLine($"OPNETCLI: An unexpected error occured. Detail: {ex.Message}",
                ConsoleColor.Red);
        }

        console.ResetColor();
    }
}
