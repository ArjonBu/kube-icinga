import {LoggerInstance} from 'winston';
import IcingaClient from 'icinga2-api';

/**
 * icinga wrapper
 */
export default class Icinga {
  protected logger: LoggerInstance;
  protected icingaClient: IcingaClient;

  /**
   * icinga wrapper
   */
  constructor(logger: LoggerInstance, icingaClient: IcingaClient) {
    this.logger = logger;
    this.icingaClient = icingaClient;
  }

  /**
   * Check if check command is available
   */
  public hasCheckCommand(command: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.icingaClient.getCheckCommand(command, (err, result) => {
        if (err) {
          if (err.Statuscode == '404') {
            resolve(false);
          } else {
            reject();
          }
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * Create host group
   */
  public applyHostGroup(name: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.logger.info(`apply host group ${name} aka kubernetes namespace`);

      this.icingaClient.getHostGroup(name, (err, result) => {
        if (err) {
          if (err.Statuscode == '404') {
            this.logger.info(`host group ${name} on monitoring was not found, create one`, {error: err});

            this.icingaClient.createHostGroup(name, name, [], (err, result) => {
              resolve();

              if (err) {
                this.logger.error(`failed create host group ${name}`, {error: err});
              } else {
                this.logger.info(`host group ${name} was created successfully`, {result: result});
              }
            });
          } else {
            reject();
          }
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Create service group
   */
  public applyServiceGroup(name: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.logger.info(`apply service group ${name} aka kubernetes namespace`);

      this.icingaClient.getServiceGroup(name, (err, result) => {
        if (err) {
          if (err.Statuscode == '404') {
            this.logger.info(`service group ${name} on monitoring was not found, create one`, {error: err});

            this.icingaClient.createServiceGroup(name, name, [], (err, result) => {
              resolve(true);

              if (err) {
                this.logger.error(`failed create service group ${name}`, {error: err});
              } else {
                this.logger.info(`service group ${name} was created successfully`, {result: result});
              }
            });
          } else {
            reject();
          }
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * Create or update a new icinga host object
   */
  public applyHost(name: string, address: string, definition, templates: string[]=[]): Promise<boolean> {
    let host = {
      attrs: definition,
      templates: templates,
    };

    return new Promise((resolve, reject) => {
      this.logger.info(`apply new host ${name}`, {host: host});

      this.icingaClient.getHostState(name, (err, result) => {
        if (err) {
          if (err.Statuscode == '404') {
            this.logger.info(`host ${name} on monitoring was not found, create one`, {error: err});

            this.icingaClient.createHostCustom(JSON.stringify(host), name, (err, result) => {
              resolve(true);

              if (err) {
                this.logger.error(`failed create host ${name}`, {error: err});
              } else {
                this.logger.info(`host ${name} was created successfully`, {result: result});
              }
            });
          } else {
            reject();
          }
        }
      });
    });
  }

  /**
   * Create or update an icinga service object
   */
  public applyService(host: string, name: string, definition, templates: string[]=[]) {
    let service = {
      attrs: definition,
      templates: templates,
    };

    this.logger.info(`apply service ${name} to host ${host}`, {service: definition});

    this.icingaClient.getService(host, name, (err, result) => {
      if (err) {
        if (err.Statuscode == '404') {
          this.logger.info(`service ${name} on host ${host} was not found, create one`, {error: err});

          this.icingaClient.createServiceCustom(JSON.stringify(service), host, name, (err, result) => {
            if (err) {
              this.logger.error(`failed create service ${name} on host ${host}`, {error: err});
            } else {
              this.logger.info(`service ${name} on host ${host} was created successfully`, {result: result});
            }
          });
        }
      }
    });
  }

  /**
   * Delete icinga service object
   */
  public deleteService(host: string, name: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.logger.info(`delete service ${name} from host ${host}`);

      return this.icingaClient.deleteService(name, host, (err, result) => {
        resolve(true);
        if (err) {
          this.logger.error(`failed delete service ${name} from host ${host}`, {error: err});
        } else {
          this.logger.info(`service ${name} was deleted successfully from host ${host}`, {result: result});
        }
      });
    });
  }

  /**
   * Delete icinga host object
   */
  public deleteHost(name: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.logger.info(`delete host ${name}`);

      this.icingaClient.deleteHost(name, (err, result) => {
        resolve(true);
        if (err) {
          this.logger.error(`failed delete host ${name}`, {error: err});
        } else {
          this.logger.info(`host ${name} was deleted successfully`, {result: result});
        }
      });
    });
  }

  /**
   * Cleanup all previously deployed icinga kubernetes objects
   */
  public async cleanup(): Promise<any> {
    this.logger.info('start cleanup, removing all kubernetes objects from icinga');

    return new Promise((resolve, reject) => {
      this.icingaClient.getServiceFiltered({filter: 'service.vars._kubernetes == true'}, async (err, result) => {
        const handlers = [];
        for (const service of result) {
          handlers.push(this.deleteService(service.attrs.host_name, service.attrs.name));
        }

        await Promise.all(handlers);
        resolve(true);
      });

      this.icingaClient.getHostFiltered({filter: 'host.vars._kubernetes == true'}, async (err, result) => {
        const handlers = [];
        for (const host of result) {
          handlers.push(this.deleteHost(host.attrs.name));
        }

        await Promise.all(handlers);
        resolve(true);
      });
    });
  }
}
