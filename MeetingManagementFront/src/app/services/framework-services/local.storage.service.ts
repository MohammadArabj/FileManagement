import { Injectable } from "@angular/core"

@Injectable({
  providedIn: 'root'
})
export class LocalStorageService {
  getItem(name: string): string {
    return localStorage.getItem(name) || ''
  }

  setItem(name: string, value: string): void {
    if (this.exists(name))
      this.removeItem(name)

    localStorage.setItem(name, value)
  }

  exists(name: string): boolean {
    var value = this.getItem(name);
    if (this.getItem(name) == null || this.getItem(name) == '')
      return false
    return true
  }

  removeItem(name: string): void {
    localStorage.removeItem(name)
  }
}
