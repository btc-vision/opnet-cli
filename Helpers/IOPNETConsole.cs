namespace opnetcli.Helpers;

public interface IOPNETConsole
{
    void ResetColor();
    void WriteLine(string message);
    void WriteLine(string message, ConsoleColor foregroundColor);
    ConsoleColor ForegroundColor { get; set; }
    System.Text.Encoding OutputEncoding { get; set; }
}
