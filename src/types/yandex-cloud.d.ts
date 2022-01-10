// TODO: remove it after migration to yandex-cloud@2.X
import { Session } from 'yandex-cloud';

declare module 'yandex-cloud/api/operation' {
    export interface Operation {
        completion: (session: Session) => Promise<Operation>
        getResponse: () => { id: string }
    }
}
