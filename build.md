# To build Windows version:
dotnet build --configuration Release

## The output files are located in the following folder: 
bin/Release/net8.0

# To build MacOS x64 version:
dotnet msbuild /t:PublishToMacOSX64

## The output files are located in the following folder: 
bin/Release/net8.0/osx-x64/publish

# To build MacOS Arm64 version:
dotnet msbuild /t:PublishToMacOSArm64

## The output files are located in the following folder: 
bin/Release/net8.0/osx-arm64/publish


# To build Linux x64 version:
dotnet msbuild /t:PublishToLinux

## The output files are located in the following folder: 
bin/Release/net8.0/linux-x64/publish
