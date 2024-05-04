// Package imports
import path from "path";
import fs from "fs/promises";
// Local imports
import { getApiClientTwitch } from './oAuthTwitch';
import { validateJsonSchemaObject } from "./validate";
// Type imports
import type { ApiClient } from '@twurple/api';

const credentialsFilePath = path.join(process.cwd(), "credentials.json");
const argumentsFilePath = path.join(process.cwd(), "arguments.json");

const credentialsJsonSchemaFilePath = path.join(__dirname, "credentials.schema.json");
const argumentsJsonSchemaFilePath = path.join(__dirname, "arguments.schema.json");

const name = "banbots";
const version = "1.0.2";

export interface JSONSchemaBase {
    $schema?: string;
}

export interface Credentials extends JSONSchemaBase {
    clientId: string;
    clientSecret: string;
    scopes: ReadonlyArray<string>;
    redirectPort: number;
}

export interface Arguments extends JSONSchemaBase {
    channelName: string;
    banReason?: string;
    userNamesToBan?: ReadonlyArray<string>;
    banUsersWhoFollowedInTheLastMinutes?: number;
    unban?: boolean;
    dryRun?: boolean;
    verbose?: boolean;
}

export const main = async () => {
    for (const cliArg of process.argv.slice(2)) {
        if (cliArg === "--version") {
            console.log(`${name} v${version}`);
            process.exit(0);
        } else {
            console.warn(`Unsupported CLI argument: '${cliArg}'`);
        }
    }

    const credentials = JSON.parse(await fs.readFile(credentialsFilePath, 'utf8')) as Credentials;
    const credentialsJsonSchema = JSON.parse(await fs.readFile(credentialsJsonSchemaFilePath, 'utf8'));
    validateJsonSchemaObject<Credentials>('credentials.json', credentialsJsonSchema, credentials);
    const {
        clientId,
        clientSecret,
        scopes,
        redirectPort,
    } = credentials;
    const args = JSON.parse(await fs.readFile(argumentsFilePath, 'utf8')) as Arguments;
    const argumentsJsonSchema = JSON.parse(await fs.readFile(argumentsJsonSchemaFilePath, 'utf8'));
    validateJsonSchemaObject<Arguments>('arguments.json', argumentsJsonSchema, args);
    const {
        banReason,
        channelName,
        userNamesToBan,
        banUsersWhoFollowedInTheLastMinutes,
        dryRun,
        unban,
        verbose,
    } = args;

    const apiClient = await getApiClientTwitch(clientId, clientSecret, scopes, redirectPort, verbose);

    if (verbose === true) {
        console.info("credentials:", credentials);
        console.info("args:", args);
    }

    if (userNamesToBan !== undefined) {
        await banUsers(apiClient, channelName, userNamesToBan, banReason, unban, dryRun, verbose);
    }
    if (banUsersWhoFollowedInTheLastMinutes !== undefined) {
        const channelFollowers = await getChannelFollowers(apiClient, channelName, verbose);
        const currentDate = new Date();
        const userNamesToBanFollowers: string[] = [];
        for (const channelFollower of channelFollowers) {
            if (currentDate.getTime() - channelFollower.followDate.getTime() < banUsersWhoFollowedInTheLastMinutes * 1000 * 60) {
                userNamesToBanFollowers.push(channelFollower.userName);
            }
        }
        await banUsers(apiClient, channelName, userNamesToBanFollowers, banReason, unban, dryRun, verbose);
    }
}

export const getChannelFollowers = async (apiClient: ApiClient, channelName: string, verbose = false) => {
    const helixChannelUser = await apiClient.users.getUserByName(channelName);
    if (helixChannelUser === null) {
        throw new Error('Failed to retrieve helixChannelUser');
    }
    const helixChannelFollowersFirstPage = await apiClient.channels.getChannelFollowers(helixChannelUser.id, undefined);
    const helixChannelFollowers = [...helixChannelFollowersFirstPage.data];
    let cursor = helixChannelFollowersFirstPage.cursor;
    while (cursor !== undefined) {
        const helixChannelFollowersPage = await apiClient.channels.getChannelFollowers(
            helixChannelUser.id,
            undefined,
            { after: cursor },
        );
        helixChannelFollowers.push(...helixChannelFollowersPage.data);
        cursor = helixChannelFollowersPage.cursor;
    }
    if (verbose === true) {
        console.info('followers ', await Promise.all(helixChannelFollowers.map(a => a.getUser().then(b => b.displayName))))
    }
    return helixChannelFollowers;
}

export const banUsers = async (apiClient: ApiClient, channelName: string, userNamesToBan: ReadonlyArray<string>, reason?: string, unban = false, dryRun = false, verbose = false) => {
    const helixChannelUser = await apiClient.users.getUserByName(channelName);
    if (helixChannelUser === null) {
        throw new Error('Failed to retrieve helixChannelUser');
    }
    for (const userNameToBan of userNamesToBan) {
        const helixUserToBan = await apiClient.users.getUserByName(userNameToBan);
        if (helixUserToBan === null) {
            throw new Error('Failed to retrieve helixUserToBan');
        }
        if (verbose === true) {
            console.info('ban ', helixUserToBan.displayName, helixUserToBan.id);
        }
        if (dryRun !== true) {
            if (unban === true) {
                await apiClient.moderation.unbanUser(helixChannelUser.id, helixUserToBan.id);
            } else {
                await apiClient.moderation.banUser(helixChannelUser.id, { user: helixUserToBan.id, reason: reason ?? "No reason given" });
            }
        }
    }
}

main().catch(err => console.error(err))
