// Package imports
import {spawn} from 'child_process';

export const getOpenCommand = () => {
    switch(process.platform) {
        case 'darwin':
            return 'open';
        case 'win32':
            return 'explorer.exe';
        case 'linux':
            return 'xdg-open';
        default:
            throw new Error(`Unsupported platform to open URLs: ${process.platform}`);
    }
}

export const openUrl = (url: string): Promise<void> => {
    const child = spawn(getOpenCommand(), [url]);
    let errorText = "";
    let errorWasThrown = false;
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (data) => {
        errorText += data;
    });
    return new Promise<void>((resolve, reject) => {
        child.stderr.on('end', () => {
            errorWasThrown = true;
            if (errorText.length > 0) {
                reject(new Error(errorText));
            } else {
                reject(new Error("Unexpected error while trying to open a URL"));
            }
        });
        child.on("close", () => {
            if (errorWasThrown === false) {
                resolve();
            }
        })
    })
}
