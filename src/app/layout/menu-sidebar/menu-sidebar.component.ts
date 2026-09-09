import {ChangeDetectorRef, Component, HostBinding, OnChanges, OnInit, SimpleChanges} from '@angular/core';
import {Store} from '@ngrx/store';
import {Observable, debounce, debounceTime} from 'rxjs';
import { AppState } from '../../store/state';
import { UiState } from '../../store/ui/state';
import { ConfigService } from '../../core/services/config.service';
import { Route, Router } from '@angular/router';
import { MenuItem } from './menu-item.model';
import { AuthService } from '../../shared/service/auth.service';
import { OfflineContextService } from '../../core/offline/offline-context.service';

const BASE_CLASSES = 'main-sidebar elevation-4';
@Component({
    selector: 'app-menu-sidebar',
    templateUrl: './menu-sidebar.component.html',
    styleUrls: ['./menu-sidebar.component.scss']
})
export class MenuSidebarComponent implements OnInit {
    @HostBinding('class') classes: string = BASE_CLASSES;
    public ui: Observable<UiState>;
    public user;
    title
    menu: MenuItem[] = []
    modoOperacao = "external"

    constructor(
        private config : ConfigService,
        private store: Store<AppState>,
        private router: Router,
        private authService : AuthService,
        private offline: OfflineContextService,
        private ref: ChangeDetectorRef
    ) {}

    ngOnInit() {
        this.modoOperacao = this.config.getModoOperacao()
        this.title = this.config.title
        this.ui = this.store.select('ui');
        this.ui.subscribe((state: UiState) => {
            this.classes = `${BASE_CLASSES} ${state.sidebarSkin}`;
        });
        this.menu = this.createMenu(this.router.config);
        this.authService.loginChange$.subscribe(() => {
            this.menu = this.createMenu(this.router.config);
        })
        let onlineSalesAvailable = this.offline.onlineSalesAvailable
        let offlineEnabled = this.offline.offlineEnabled
        this.offline.state$.subscribe(() => {
            const current = this.offline.onlineSalesAvailable
            const currentOfflineEnabled = this.offline.offlineEnabled
            if(current !== onlineSalesAvailable || currentOfflineEnabled !== offlineEnabled){
                onlineSalesAvailable = current
                offlineEnabled = currentOfflineEnabled
                this.menu = this.createMenu(this.router.config)
            }
        })
    }

    async logout() {
        await this.offline.explicitLogout()
        this.authService.logout()
    }

    isLoggedIn() : boolean {
        return this.authService.isLoggedIn() || this.offline.canEnterOfflineRoutes
    }

    isKeycloak() : boolean {
        return this.authService.isKeycloak()
    }

    userName() {
        try {
            return this.authService.getUser()
        } catch {
            return this.offline.snapshot.session?.userName || 'Usuário offline'
        }
    }


    createMenu(routes: Route[], parentSegments: string[] = []) : Array<MenuItem> {
        const menu: MenuItem[] = [];
        routes.filter(it =>
            this.isTemTitulo(it) && !this.isHidden(it) && this.isShowGuard(it) && this.isRolePermitida(it)
            && this.isOfflineRoutePermitida(it, parentSegments)
            && (
                (this.modoOperacao == "internal" && this.isRouteInternal(it))
                ||
                (this.modoOperacao != "internal" && !this.isRouteInternal(it))
            )
            && ((this.isLoggedIn() && !this.authService.isCliente()) || ['home', 'faturas'].includes(it.path))
        )
        .forEach(route => {
            const item = new MenuItem(route, parentSegments);
            if (route.children) {
                item.children = this.createMenu(route.children, item.childSegments);
            }
            menu.push(item);
        })
        return menu
    }

    isShowGuard(route : Route) : boolean{
        if(route.canActivate)
            return this.isLoggedIn()
        return true
    }

    private isOfflineRoutePermitida(route: Route, parentSegments: string[]): boolean {
        const path = [...parentSegments, route.path || ''].filter(Boolean).join('/')
        if(!this.offline.offlineEnabled && path === 'venda/offline')
            return false
        if(this.offline.onlineSalesAvailable)
            return true
        return path === 'venda' || path === 'venda/document' || path === 'venda/offline'
    }

    /**
     * Item marcado com "role:xxx" no data so aparece pra quem tem o papel. Sem a marcacao, a
     * rota continua visivel pra todo mundo - o filtro e opt-in pra nao mexer no menu existente.
     */
    isRolePermitida(route : Route) : boolean {
        const exigida = (route?.data as Array<any> ?? [])
            .map(it => it.toString())
            .find(it => it.startsWith("role:"))
        if(!exigida)
            return true
        return this.authService.hasRole(exigida.replace("role:", ""))
    }

    isHidden(it){
        return it?.data?.filter(item => item.toString() == "hidden").toString() == 'hidden'
    }

    isTemTitulo(it){
        return it.title != undefined
    }

    isRouteInternal(it : Route) : boolean {
        return it?.data?.filter(item => item.toString() == "internal").toString() == 'internal'
    }

}
