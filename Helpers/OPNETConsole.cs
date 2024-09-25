namespace opnetcli.Helpers;

public class OPNETConsole : IOPNETConsole
{
    public void ResetColor()
    {
        Console.ResetColor();
    }

    public void WriteLine(string message)
    {
        Console.WriteLine(message);
    }

    public void WriteLine(string message, 
        ConsoleColor foregroundColor)
    {
        ForegroundColor = foregroundColor;
        WriteLine(message);
        ResetColor();
    }

    public ConsoleColor ForegroundColor
    {
        get { return Console.ForegroundColor; }
        set { Console.ForegroundColor = value; }
    }

    public System.Text.Encoding OutputEncoding 
    {
        get { return Console.OutputEncoding; }
        set { Console.OutputEncoding = value; }
    }
}
